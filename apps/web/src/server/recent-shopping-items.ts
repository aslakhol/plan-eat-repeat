import { editOwnItem, shoppingItemDetails } from "./own-items";
import {
  combineShoppingRequirements,
  type ShoppingRequirement,
} from "./shopping-list";
import type { Prisma, ShoppingCategory } from "@planeatrepeat/db";
import { normalizeUnit } from "@planeatrepeat/shared";

export async function rememberShoppingItems(
  tx: Prisma.TransactionClient,
  householdId: string,
  items: { ownItemId: string; amount: number | null; unit: string | null }[],
) {
  if (items.length === 0) return [];
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const latest = await tx.recentShoppingItem.findFirst({
    where: { householdId },
    orderBy: { recentlyUsedAt: "desc" },
  });
  const recentlyUsedAt = new Date(
    Math.max(Date.now(), (latest?.recentlyUsedAt.getTime() ?? 0) + 1),
  );
  const distinct = new Map(items.map((item) => [item.ownItemId, item]));
  const saved = [];
  for (const [ownItemId, item] of distinct) {
    const data = {
      amount: item.amount,
      unit: normalizeUnit(item.unit),
      recentlyUsedAt,
      revision: crypto.randomUUID(),
    };
    saved.push(
      await tx.recentShoppingItem.upsert({
        where: { ownItemId, householdId },
        create: { householdId, ownItemId, ...data },
        update: data,
      }),
    );
  }
  return saved;
}

export async function editRecentShoppingItem(
  tx: Prisma.TransactionClient,
  householdId: string,
  input: ShoppingRequirement & {
    id: string;
    category?: ShoppingCategory;
    usuallyHave?: boolean;
  },
) {
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const original = await tx.recentShoppingItem.findUniqueOrThrow({
    where: { id: input.id, householdId },
  });
  const { ownItem, reassignedRequirementIds } = await editOwnItem(
    tx,
    householdId,
    original.ownItemId,
    input,
  );
  await combineShoppingRequirements(
    tx,
    householdId,
    ownItem.id,
    reassignedRequirementIds,
  );
  return shoppingItemDetails(
    await tx.recentShoppingItem.update({
      where: { ownItemId: ownItem.id, householdId },
      include: { ownItem: true },
      data: {
        amount: input.amount,
        unit: normalizeUnit(input.unit),
        revision: crypto.randomUUID(),
      },
    }),
  );
}
