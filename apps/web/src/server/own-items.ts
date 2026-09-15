import type {
  Prisma,
  ShoppingCategory,
  ShoppingLanguage,
} from "@planeatrepeat/db";
import { normalizeShoppingName } from "@planeatrepeat/shared";
import { shoppingCatalog } from "./shopping-catalog";

const catalogs = {
  en: new Map(
    shoppingCatalog.map(({ en, category }) => [
      normalizeShoppingName(en),
      category,
    ]),
  ),
  no: new Map(
    shoppingCatalog.map(({ no, category }) => [
      normalizeShoppingName(no),
      category,
    ]),
  ),
} satisfies Record<ShoppingLanguage, Map<string, ShoppingCategory>>;

export const rememberOwnItem = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  note: string | null = null,
  initialCategory?: ShoppingCategory,
) => {
  note = note?.trim() || null;
  const normalizedNote = normalizeShoppingName(note ?? "");
  const normalizedName = normalizeShoppingName(name);
  const existing = await tx.ownItem.findUnique({
    where: {
      householdId_normalizedName_normalizedNote: {
        householdId,
        normalizedName,
        normalizedNote,
      },
    },
  });
  if (existing) return existing;

  const { shoppingLanguage } = await tx.household.findUniqueOrThrow({
    where: { id: householdId },
    select: { shoppingLanguage: true },
  });
  const catalog = catalogs[shoppingLanguage];
  let category: ShoppingCategory | undefined =
    initialCategory ?? catalog.get(normalizedName);
  if (!category) {
    const remembered = await tx.ownItem.findMany({
      where: { householdId },
      select: { normalizedName: true, category: true },
    });
    const candidates = new Map<string, ShoppingCategory>(catalog);
    for (const product of remembered) {
      candidates.set(product.normalizedName, product.category);
    }
    let longest = 0;
    let earliest = Infinity;
    for (const [phrase, candidate] of candidates) {
      if (candidate === "OWN_ITEMS") continue;
      const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const position = normalizedName.search(
        new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, "u"),
      );
      if (position < 0) continue;
      if (
        phrase.length > longest ||
        (phrase.length === longest && position < earliest)
      ) {
        category = candidate;
        longest = phrase.length;
        earliest = position;
      }
    }
  }
  return tx.ownItem.create({
    data: {
      householdId,
      name: name.trim().charAt(0).toUpperCase() + name.trim().slice(1),
      note,
      normalizedNote,
      normalizedName,
      category: category ?? "OWN_ITEMS",
    },
  });
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
  },
) {
  const original = await tx.ownItem.findUniqueOrThrow({
    where: { id, householdId },
  });
  const name = input.name.trim();
  const note = input.note?.trim() || null;
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
  if (ownItemId !== original.id) {
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
    },
  });
  // A definition edit invalidates Dinner Undo for every referring requirement.
  if (
    ownItemId !== original.id ||
    saved.name !== original.name ||
    saved.note !== original.note ||
    saved.category !== original.category ||
    saved.usuallyHave !== original.usuallyHave
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
  return saved;
}
