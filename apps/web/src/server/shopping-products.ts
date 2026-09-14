import type { Prisma } from "@planeatrepeat/db";
import { normalizeShoppingName } from "@planeatrepeat/shared";

export const rememberShoppingProduct = (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
) => {
  const normalizedName = normalizeShoppingName(name);
  return tx.shoppingProduct.upsert({
    where: { householdId_normalizedName: { householdId, normalizedName } },
    create: { householdId, name: name.trim(), normalizedName },
    update: {},
  });
};
