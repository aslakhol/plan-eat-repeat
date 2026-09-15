import type { Prisma } from "@planeatrepeat/db";
import { TRPCError } from "@trpc/server";
import { normalizeShoppingName } from "@planeatrepeat/shared";
import { rememberOwnItem } from "./own-items";
import { shoppingCatalog } from "./shopping-catalog";
import type { ShoppingSelection, ShoppingSource } from "./shopping-matching";

export async function shoppingSources(
  tx: Prisma.TransactionClient,
  householdId: string,
): Promise<ShoppingSource[]> {
  const [ownItems, household] = await Promise.all([
    tx.ownItem.findMany({ where: { householdId } }),
    tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { shoppingLanguage: true },
    }),
  ]);
  return [
    ...ownItems,
    ...shoppingCatalog.map((item) => ({
      name: item[household.shoppingLanguage],
      note: null,
      category: item.category,
    })),
  ];
}

// Call inside the Household's locked shopping transaction. Destination ownership
// always wins over the source's current category and Usually Have setting.
export async function resolveShoppingSelection(
  tx: Prisma.TransactionClient,
  householdId: string,
  selection: ShoppingSelection,
) {
  if ("ownItemId" in selection)
    return tx.ownItem.findUniqueOrThrow({
      where: { id: selection.ownItemId, householdId },
    });
  const source = selection.source;
  let category;
  if (source && "ownItemId" in source) {
    category = (
      await tx.ownItem.findUniqueOrThrow({
        where: { id: source.ownItemId, householdId },
      })
    ).category;
  } else if (source) {
    const { shoppingLanguage } = await tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { shoppingLanguage: true },
    });
    category = shoppingCatalog.find(
      (item) =>
        normalizeShoppingName(item[shoppingLanguage]) ===
        normalizeShoppingName(source.standardName),
    )?.category;
    if (!category)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Shopping suggestion is no longer available",
      });
  }
  return rememberOwnItem(
    tx,
    householdId,
    selection.name,
    selection.note,
    category,
  );
}
