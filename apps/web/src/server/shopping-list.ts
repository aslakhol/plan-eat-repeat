import type { Prisma } from "@planeatrepeat/db";

export const addShoppingItem = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
) => {
  const normalizedName = name.trim().toLowerCase();
  const existing = await tx.shoppingItem.findFirst({
    where: { householdId, normalizedName, amount: null, unit: null },
    orderBy: { id: "asc" },
  });
  if (existing) return existing;
  return tx.shoppingItem.create({
    data: { householdId, name: name.trim(), normalizedName },
  });
};
