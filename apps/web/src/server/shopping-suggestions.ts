import type { Prisma, ShoppingCategory } from "@planeatrepeat/db";
import { TRPCError } from "@trpc/server";
import { normalizeShoppingName } from "@planeatrepeat/shared";
import { rememberOwnItem } from "./own-items";
import { shoppingCatalog } from "./shopping-catalog";
import type {
  ShoppingSelection,
  ShoppingSource,
} from "~/lib/shopping-matching";

export async function shoppingSources(
  tx: Prisma.TransactionClient,
  householdId: string,
): Promise<ShoppingSource[]> {
  const [ownItems, household] = await Promise.all([
    tx.ownItem.findMany({
      where: { householdId },
      select: { id: true, name: true, note: true },
    }),
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
    })),
  ];
}

// Call inside the Household's locked shopping transaction. Destination ownership
// always wins over a new classification.
export async function resolveShoppingSelection(
  tx: Prisma.TransactionClient,
  householdId: string,
  selection: ShoppingSelection,
  categories?: ReadonlyMap<string, ShoppingCategory>,
) {
  if ("ownItemId" in selection)
    return tx.ownItem.findUniqueOrThrow({
      where: { id: selection.ownItemId, householdId },
    });
  const source = selection.source;
  if (source && "ownItemId" in source) {
    await tx.ownItem.findUniqueOrThrow({
      where: { id: source.ownItemId, householdId },
    });
  } else if (source) {
    const { shoppingLanguage } = await tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { shoppingLanguage: true },
    });
    const available = shoppingCatalog.some(
      (item) =>
        normalizeShoppingName(item[shoppingLanguage]) ===
        normalizeShoppingName(source.standardName),
    );
    if (!available)
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
    categories,
  );
}
