import { TRPCError } from "@trpc/server";
import type { Prisma } from "@planeatrepeat/db";
import superjson from "superjson";
import { selectRecipeIngredient } from "~/lib/shopping-matching";
import { rememberOwnItem, shoppingItemDetails } from "./own-items";
import { saveShoppingItem } from "./shopping-list";
import {
  readRecentShoppingItems,
  rememberShoppingItems,
} from "./recent-shopping-items";
import {
  resolveShoppingSelection,
  shoppingSources,
} from "./shopping-suggestions";

async function addDinnerRequirements(
  tx: Prisma.TransactionClient,
  householdId: string,
  dinnerIds: number[],
) {
  const before = new Map(
    (
      await tx.shoppingItem.findMany({
        where: { householdId: householdId },
      })
    ).map((item) => [item.id, item]),
  );
  const recentBefore = new Map(
    (
      await tx.recentShoppingItem.findMany({
        where: { householdId: householdId },
      })
    ).map((item) => [item.ownItemId, item]),
  );
  const addedIds = new Set<string>();
  const skipped: {
    ownItemId: string;
    amount: number | null;
    unit: string | null;
  }[] = [];
  const sources = await shoppingSources(tx, householdId);
  for (const dinnerId of dinnerIds) {
    const dinner = await tx.dinner.findUniqueOrThrow({
      where: { id: dinnerId, householdId: householdId },
      include: {
        parts: {
          orderBy: { order: "asc" },
          include: { ingredients: { orderBy: { order: "asc" } } },
        },
      },
    });
    const ingredients = dinner.parts.flatMap((part) => part.ingredients);
    const requirements =
      ingredients.length > 0
        ? ingredients
        : [{ name: dinner.name, amount: null, unit: null }];
    for (const item of requirements) {
      const ownItem =
        ingredients.length > 0
          ? await resolveShoppingSelection(
              tx,
              householdId,
              selectRecipeIngredient(item.name, sources),
            )
          : await rememberOwnItem(tx, householdId, item.name);
      if (!sources.some(({ id }) => id === ownItem.id)) sources.push(ownItem);
      if (ownItem.usuallyHave) {
        skipped.push({
          ownItemId: ownItem.id,
          amount: item.amount,
          unit: item.unit,
        });
        continue;
      }
      const saved = await saveShoppingItem(tx, householdId, {
        name: ownItem.name,
        amount: item.amount,
        unit: item.unit,
        note: ownItem.note,
      });
      addedIds.add(saved.id);
    }
  }
  const recent = await rememberShoppingItems(tx, householdId, skipped);
  const added = await tx.shoppingItem.findMany({
    where: { householdId: householdId, id: { in: [...addedIds] } },
  });
  return {
    undo: {
      recent: recent.map(({ id, ownItemId, revision }) => ({
        id,
        ownItemId,
        revision,
        before: recentBefore.get(ownItemId) ?? null,
      })),
      items: added.flatMap((item) => {
        const original = before.get(item.id);
        if (original?.revision === item.revision) return [];
        return [
          {
            id: item.id,
            ownItemId: item.ownItemId,
            revision: item.revision,
            before: original ?? null,
          },
        ];
      }),
    },
  };
}

// The caller holds the Household lock for the receipt and all requirement writes.
export async function addDinnersToShoppingList(
  tx: Prisma.TransactionClient,
  householdId: string,
  input: { operationId: string; dinnerIds: number[] },
) {
  const where = {
    householdId_operationId: { householdId, operationId: input.operationId },
  };
  const receipt = await tx.shoppingDinnerAddition.findUnique({ where });
  if (
    receipt &&
    JSON.stringify(receipt.dinnerIds) !== JSON.stringify(input.dinnerIds)
  ) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "This addition has different Dinner selections.",
    });
  }
  const result = receipt
    ? superjson.parse<Awaited<ReturnType<typeof addDinnerRequirements>>>(
        receipt.result,
      )
    : await addDinnerRequirements(tx, householdId, input.dinnerIds);
  if (!receipt)
    await tx.shoppingDinnerAddition.create({
      data: {
        householdId,
        operationId: input.operationId,
        dinnerIds: input.dinnerIds,
        result: superjson.stringify(result),
      },
    });
  // A replay retains the original Undo but returns today's rows: subsequent
  // edits or removals must not be overwritten by the lost response's snapshot.
  const [items, recentItems] = await Promise.all([
    tx.shoppingItem.findMany({
      where: { householdId },
      include: { ownItem: true },
    }),
    readRecentShoppingItems(tx, householdId),
  ]);
  return { ...result, items: items.map(shoppingItemDetails), recentItems };
}
