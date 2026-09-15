import {
  editShoppingProduct,
  rememberShoppingProduct,
} from "./shopping-products";
import type { Prisma, ShoppingCategory, ShoppingItem } from "@planeatrepeat/db";
import { normalizeShoppingName, normalizeUnit } from "@planeatrepeat/shared";

export async function rememberShoppingItems(
  tx: Prisma.TransactionClient,
  householdId: string,
  items: Pick<ShoppingItem, "name" | "amount" | "unit" | "note">[],
) {
  if (items.length === 0) return [];
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const latest = await tx.recentShoppingItem.findFirst({
    where: { householdId },
    orderBy: { recentlyUsedAt: "desc" },
  });
  // Separate operations remain ordered even if they happen in the same millisecond.
  const recentlyUsedAt = new Date(
    Math.max(Date.now(), (latest?.recentlyUsedAt.getTime() ?? 0) + 1),
  );
  const distinct = new Map(
    items.map((item) => [normalizeShoppingName(item.name), item]),
  );
  const saved = [];
  for (const [normalizedName, item] of distinct) {
    const name = item.name.trim();
    const product = await rememberShoppingProduct(tx, householdId, name);
    const data = {
      productId: product.id,
      name: name.charAt(0).toUpperCase() + name.slice(1),
      normalizedName,
      amount: item.amount,
      unit: normalizeUnit(item.unit),
      note: item.note,
      recentlyUsedAt,
      revision: crypto.randomUUID(),
    };
    saved.push(
      await tx.recentShoppingItem.upsert({
        where: { householdId_normalizedName: { householdId, normalizedName } },
        create: { householdId, ...data },
        update: data,
      }),
    );
  }
  return saved;
}

export async function editRecentShoppingItem(
  tx: Prisma.TransactionClient,
  householdId: string,
  input: Pick<ShoppingItem, "id" | "name" | "amount" | "unit" | "note"> & {
    category?: ShoppingCategory;
  },
) {
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const original = await tx.recentShoppingItem.findUniqueOrThrow({
    where: { id: input.id, householdId },
    include: { product: { select: { category: true } } },
  });
  const name = input.name.trim();
  const normalizedName = normalizeShoppingName(name);
  const product = await editShoppingProduct(
    tx,
    householdId,
    name,
    original.product.category,
    input.category,
  );
  const destination = await tx.recentShoppingItem.findUnique({
    where: { householdId_normalizedName: { householdId, normalizedName } },
  });
  if (destination && destination.id !== original.id) {
    await tx.recentShoppingItem.delete({
      where: { id: original.id, householdId },
    });
  }
  return tx.recentShoppingItem.update({
    include: { product: { select: { category: true } } },
    where: { id: destination?.id ?? original.id, householdId },
    data: {
      productId: product.id,
      name,
      normalizedName,
      amount: input.amount,
      unit: normalizeUnit(input.unit),
      note: input.note,
      recentlyUsedAt: new Date(
        Math.max(
          original.recentlyUsedAt.getTime(),
          destination?.recentlyUsedAt.getTime() ?? 0,
        ),
      ),
      revision: crypto.randomUUID(),
    },
  });
}
