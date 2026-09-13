import type { Prisma, ShoppingItem } from "@planeatrepeat/db";
import { convertUnitAmount, normalizeUnit } from "@planeatrepeat/shared";

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
  const item = {
    ...fields,
    name: input.name.trim(),
    normalizedName: input.name.trim().toLowerCase(),
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
      where: { id, householdId },
      data: item,
    });
  }
  return tx.shoppingItem.create({
    data: { householdId, ...item },
  });
};
