import { editOwnItem, rememberOwnItem, shoppingItemDetails } from "./own-items";
import type { Prisma, ShoppingCategory } from "@planeatrepeat/db";
import { convertUnitAmount, normalizeUnit } from "@planeatrepeat/shared";
import type { OdaProductPreference } from "~/lib/oda-product";

export type ShoppingRequirement = {
  name: string;
  note: string | null;
  amount: number | null;
  unit: string | null;
};

// Keep destination requirements and their units ahead of reassigned or edited rows.
export async function combineShoppingRequirements(
  tx: Prisma.TransactionClient,
  householdId: string,
  ownItemId: string,
  editedRequirementIds: string[] = [],
) {
  const items = await tx.shoppingItem.findMany({
    where: { householdId, ownItemId },
    orderBy: { id: "asc" },
  });
  const edited = new Set(editedRequirementIds);
  items.sort((a, b) => Number(edited.has(a.id)) - Number(edited.has(b.id)));
  const kept: typeof items = [];
  const destinations = new Map<string, string>();
  for (const item of items) {
    let combined = false;
    for (const destination of kept) {
      if ((item.amount === null) !== (destination.amount === null)) continue;
      const sameUnit =
        normalizeUnit(item.unit) === normalizeUnit(destination.unit);
      const converted =
        item.amount === null || sameUnit
          ? item.amount
          : convertUnitAmount(item.amount, item.unit, destination.unit);
      if (!sameUnit && converted === null) continue;
      // Repeated unspecified requirements with the same unit still deduplicate.
      const amount =
        converted === null ? null : destination.amount! + converted;
      if (amount !== destination.amount) {
        await tx.shoppingItem.update({
          where: { id: destination.id, householdId },
          data: { amount, revision: crypto.randomUUID() },
        });
        destination.amount = amount;
      }
      await tx.shoppingItem.delete({ where: { id: item.id, householdId } });
      destinations.set(item.id, destination.id);
      combined = true;
      break;
    }
    if (!combined) kept.push(item);
  }
  return destinations;
}

export const saveShoppingItemWithMerges = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  input: ShoppingRequirement & {
    id?: string;
    category?: ShoppingCategory;
    usuallyHave?: boolean;
    odaProduct?: OdaProductPreference | null;
  },
) => {
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  if (!input.id)
    await tx.odaTransfer.updateMany({
      where: { householdId, state: "COMPLETED", dismissed: false },
      data: { dismissed: true },
    });
  const original = input.id
    ? await tx.shoppingItem.findUniqueOrThrow({
        where: { id: input.id, householdId },
      })
    : null;
  const { ownItem, reassignedRequirementIds } = original
    ? await editOwnItem(tx, householdId, original.ownItemId, input)
    : {
        ownItem: await rememberOwnItem(tx, householdId, input.name, input.note),
        reassignedRequirementIds: [],
      };
  const quantity = { amount: input.amount, unit: normalizeUnit(input.unit) };
  const item = original
    ? await tx.shoppingItem.update({
        where: { id: original.id, householdId },
        data: {
          ...quantity,
          ...(quantity.amount !== original.amount ||
          quantity.unit !== original.unit
            ? { revision: crypto.randomUUID() }
            : {}),
        },
      })
    : await tx.shoppingItem.create({
        data: { householdId, ownItemId: ownItem.id, ...quantity },
      });
  const destinations = await combineShoppingRequirements(
    tx,
    householdId,
    ownItem.id,
    [...reassignedRequirementIds, item.id],
  );
  const saved = shoppingItemDetails(
    await tx.shoppingItem.findUniqueOrThrow({
      where: { id: destinations.get(item.id) ?? item.id, householdId },
      include: { ownItem: true },
    }),
  );
  return { ...saved, mergedIds: Object.fromEntries(destinations) };
};

export async function saveShoppingItem(
  ...args: Parameters<typeof saveShoppingItemWithMerges>
) {
  const { mergedIds: _mergedIds, ...saved } = await saveShoppingItemWithMerges(
    ...args,
  );
  return saved;
}

export const setUsuallyHave = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  selection: { id: string } | { name: string; note?: string | null },
  excluded: boolean,
) => {
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const item =
    "id" in selection
      ? await tx.ownItem.findUniqueOrThrow({
          where: { id: selection.id, householdId },
        })
      : await rememberOwnItem(tx, householdId, selection.name, selection.note);
  const { ownItem } = await editOwnItem(tx, householdId, item.id, {
    ...item,
    usuallyHave: excluded,
  });
  return ownItem;
};
