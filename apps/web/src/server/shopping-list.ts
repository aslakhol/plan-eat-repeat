import { rememberShoppingProduct } from "./shopping-products";
import type { Prisma, ShoppingItem } from "@planeatrepeat/db";
import {
  convertUnitAmount,
  normalizeShoppingName,
  normalizeUnit,
} from "@planeatrepeat/shared";

export const saveShoppingItem = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  input: Pick<ShoppingItem, "name" | "amount" | "unit" | "note"> & {
    id?: string;
  },
) => {
  // Serialize combining writes so two members cannot both create the same row.
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const { id, ...fields } = input;
  if (id) {
    await tx.shoppingItem.findUniqueOrThrow({ where: { id, householdId } });
  }
  const name = input.name.trim();
  const product = await rememberShoppingProduct(tx, householdId, name);
  const item = {
    productId: product.id,
    ...fields,
    name: id ? name : name.charAt(0).toUpperCase() + name.slice(1),
    normalizedName: normalizeShoppingName(name),
    unit: normalizeUnit(input.unit),
  };
  const candidates = await tx.shoppingItem.findMany({
    where: {
      householdId,
      normalizedName: item.normalizedName,
      ...(id ? { id: { not: id } } : {}),
    },
    orderBy: { id: "asc" },
  });

  for (const destination of candidates) {
    if ((item.amount === null) !== (destination.amount === null)) continue;
    const sameUnit = item.unit === normalizeUnit(destination.unit);
    const convertedAmount =
      item.amount === null || sameUnit
        ? item.amount
        : convertUnitAmount(item.amount, item.unit, destination.unit);
    if (!sameUnit && convertedAmount === null) continue;

    const notes = [destination.note, item.note]
      .flatMap((note) => note?.split(";") ?? [])
      .map((note) => note.trim())
      .filter(Boolean);
    const combined = await tx.shoppingItem.update({
      include: { product: { select: { category: true } } },
      where: { id: destination.id, householdId },
      data: {
        amount:
          convertedAmount === null ? null : { increment: convertedAmount },
        note: [...new Set(notes)].join("; ") || null,
      },
    });
    if (id) await tx.shoppingItem.delete({ where: { id, householdId } });
    return combined;
  }

  if (id) {
    return tx.shoppingItem.update({
      include: { product: { select: { category: true } } },
      where: { id, householdId },
      data: item,
    });
  }
  return tx.shoppingItem.create({
    include: { product: { select: { category: true } } },
    data: { householdId, ...item },
  });
};

export const setUsuallyHave = async (
  tx: Prisma.TransactionClient,
  householdId: string,
  name: string,
  excluded: boolean,
) => {
  await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${householdId} FOR UPDATE`;
  const normalizedName = normalizeShoppingName(name);
  if (excluded) {
    const product = await rememberShoppingProduct(tx, householdId, name);
    await tx.usuallyHave.upsert({
      where: { householdId_normalizedName: { householdId, normalizedName } },
      create: {
        householdId,
        name: name.trim(),
        normalizedName,
        productId: product.id,
      },
      update: {},
    });
  } else {
    await tx.usuallyHave.deleteMany({ where: { householdId, normalizedName } });
  }
};
