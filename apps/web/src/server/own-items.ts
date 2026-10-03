import type { Prisma, ShoppingCategory } from "@planeatrepeat/db";
import {
  capitalizeShoppingName,
  normalizeShoppingName,
} from "@planeatrepeat/shared";
import {
  resolveShoppingItems,
  type ShoppingResolution,
} from "./ai/resolve-shopping-items";
import { shoppingIdentity } from "~/lib/shopping-matching";
import { shoppingCatalog } from "./shopping-catalog";
import { TRPCError } from "@trpc/server";
import type { OdaProductPreference } from "~/lib/oda-product";

// Resolve before opening a transaction. Recheck identity when saving: another
// household member may have created or corrected the same Own Item meanwhile.
// Exact standard names take their catalog category. Only typed input is
// matched; a chosen suggestion already names its product.
export async function resolveNewOwnItems(
  db: Prisma.TransactionClient,
  householdId: string,
  items: readonly { name: string; note: string | null }[],
  { match }: { match: boolean },
) {
  const [existing, household] = await Promise.all([
    db.ownItem.findMany({
      where: { householdId },
      select: { id: true, name: true, note: true },
    }),
    db.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { shoppingLanguage: true },
    }),
  ]);
  const known = new Set(
    existing.map((item) => shoppingIdentity(item.name, item.note)),
  );
  const newItems = new Map(
    items
      .filter((item) => !known.has(shoppingIdentity(item.name, item.note)))
      .map(({ name, note }) => {
        const trimmedNote = note?.trim() ?? "";
        return [
          shoppingIdentity(name, note),
          {
            name: capitalizeShoppingName(name),
            note: trimmedNote === "" ? null : trimmedNote,
          },
        ] as const;
      }),
  );
  return resolveShoppingItems(
    [...newItems.values()],
    household.shoppingLanguage,
    {
      candidates: [
        ...existing.map(({ id, name, note }) => ({
          ownItemId: id,
          name,
          note,
        })),
        ...shoppingCatalog
          .map((item) => ({
            name: item[household.shoppingLanguage],
            note: null,
            category: item.category,
          }))
          .filter((item) => !known.has(shoppingIdentity(item.name, null))),
      ],
      match,
    },
  );
}

const findOwnItem = (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  note: string | null,
) =>
  tx.ownItem.findUnique({
    where: {
      householdId_normalizedName_normalizedNote: {
        householdId,
        normalizedName: normalizeShoppingName(name),
        normalizedNote: normalizeShoppingName(note ?? ""),
      },
    },
  });

const shoppingItemsChanged = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "Shopping items changed. Try adding the item again.",
  });

export const rememberOwnItem = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  note: string | null = null,
  resolutions: ReadonlyMap<string, ShoppingResolution> = new Map(),
) => {
  const existing = await findOwnItem(tx, householdId, name, note);
  if (existing) return existing;

  const resolution = resolutions.get(shoppingIdentity(name, note));
  if (!resolution) throw shoppingItemsChanged();
  if ("ownItemId" in resolution) {
    const matched = await tx.ownItem.findUnique({
      where: { id: resolution.ownItemId, householdId },
    });
    if (!matched) throw shoppingItemsChanged();
    return matched;
  }
  return (
    (await findOwnItem(tx, householdId, resolution.name, resolution.note)) ??
    tx.ownItem.create({
      data: {
        householdId,
        name: capitalizeShoppingName(resolution.name),
        note: resolution.note,
        normalizedName: normalizeShoppingName(resolution.name),
        normalizedNote: normalizeShoppingName(resolution.note ?? ""),
        category: resolution.category,
      },
    })
  );
};

// Requirement views read names and notes from their saved definition.
export function shoppingItemDetails<
  T extends {
    ownItem: { name: string; normalizedName: string; note: string | null };
  },
>(item: T) {
  return {
    ...item,
    name: item.ownItem.name,
    normalizedName: item.ownItem.normalizedName,
    note: item.ownItem.note,
  };
}

export async function editOwnItem(
  tx: Prisma.TransactionClient,
  householdId: string,
  id: string,
  input: {
    name: string;
    note: string | null;
    category?: ShoppingCategory;
    usuallyHave?: boolean;
    odaProduct?: OdaProductPreference | null;
  },
) {
  const original = await tx.ownItem.findUniqueOrThrow({
    where: { id, householdId },
  });
  if (
    input.odaProduct !== undefined &&
    !(await tx.odaConnection.findUnique({ where: { householdId } }))
  )
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Connect Oda in Shopping List settings.",
    });
  const name = input.name.trim();
  const trimmedNote = input.note?.trim() ?? "";
  const note = trimmedNote.length > 0 ? trimmedNote : null;
  const normalizedName = normalizeShoppingName(name);
  const normalizedNote = normalizeShoppingName(note ?? "");
  const destination = await tx.ownItem.findUnique({
    where: {
      householdId_normalizedName_normalizedNote: {
        householdId,
        normalizedName,
        normalizedNote,
      },
    },
  });
  const ownItemId = destination?.id ?? original.id;
  const reassignedRequirementIds: string[] = [];
  if (ownItemId !== original.id) {
    const requirements = await tx.shoppingItem.findMany({
      where: { householdId, ownItemId: original.id },
      select: { id: true },
    });
    reassignedRequirementIds.push(...requirements.map(({ id }) => id));
    await tx.shoppingItem.updateMany({
      where: { householdId, ownItemId: original.id },
      data: { ownItemId },
    });
    const recent = await tx.recentShoppingItem.findMany({
      where: { householdId, ownItemId: { in: [original.id, ownItemId] } },
      orderBy: { recentlyUsedAt: "desc" },
    });
    const [latest, older] = recent;
    if (older)
      await tx.recentShoppingItem.delete({
        where: { id: older.id, householdId },
      });
    if (latest)
      await tx.recentShoppingItem.update({
        where: { id: latest.id, householdId },
        data: { ownItemId },
      });
    await tx.ownItem.delete({ where: { id: original.id, householdId } });
  }
  const saved = await tx.ownItem.update({
    where: { id: ownItemId, householdId },
    data: {
      name,
      normalizedName,
      note,
      normalizedNote,
      category: input.category ?? original.category,
      usuallyHave: input.usuallyHave ?? original.usuallyHave,
      // With no explicit selection, a merge keeps the destination's preference.
      ...(input.odaProduct !== undefined
        ? {
            odaProductId: input.odaProduct?.id ?? null,
            odaProductName: input.odaProduct?.name ?? null,
            odaProductDescription: input.odaProduct?.description ?? null,
          }
        : {}),
    },
  });
  // A definition edit invalidates Dinner Undo for every referring requirement.
  if (
    ownItemId !== original.id ||
    saved.name !== original.name ||
    saved.note !== original.note ||
    saved.category !== original.category ||
    saved.usuallyHave !== original.usuallyHave ||
    saved.odaProductId !== original.odaProductId
  ) {
    await tx.shoppingItem.updateMany({
      where: { householdId, ownItemId },
      data: { revision: crypto.randomUUID() },
    });
    await tx.recentShoppingItem.updateMany({
      where: { householdId, ownItemId },
      data: { revision: crypto.randomUUID() },
    });
  }
  return { ownItem: saved, reassignedRequirementIds };
}
