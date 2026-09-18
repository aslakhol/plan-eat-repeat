import { TRPCError } from "@trpc/server";
import type { OwnItem, Prisma, ShoppingItem } from "@planeatrepeat/db";
import {
  capitalizeShoppingName,
  normalizeShoppingName,
  normalizeUnit,
} from "@planeatrepeat/shared";
import superjson from "superjson";
import {
  selectRecipeIngredient,
  shoppingIdentity,
  type ShoppingSource,
} from "~/lib/shopping-matching";
import { ownItemCategory, shoppingItemDetails } from "./own-items";
import { readRecentShoppingItems } from "./recent-shopping-items";
import { combineShoppingQuantity } from "./shopping-list";
import { shoppingCatalog } from "./shopping-catalog";

async function addDinnerRequirements(
  tx: Prisma.TransactionClient,
  householdId: string,
  dinnerIds: number[],
) {
  const [dinners, ownItems, household, items, recentItems] = await Promise.all([
    tx.dinner.findMany({
      where: { householdId, id: { in: dinnerIds } },
      include: {
        parts: {
          orderBy: { order: "asc" },
          include: { ingredients: { orderBy: { order: "asc" } } },
        },
      },
    }),
    tx.ownItem.findMany({ where: { householdId } }),
    tx.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { shoppingLanguage: true },
    }),
    tx.shoppingItem.findMany({
      where: { householdId },
      orderBy: { id: "asc" },
    }),
    tx.recentShoppingItem.findMany({ where: { householdId } }),
  ]);
  const dinnersById = new Map(dinners.map((dinner) => [dinner.id, dinner]));
  if (dinnerIds.some((id) => !dinnersById.has(id)))
    throw new TRPCError({ code: "NOT_FOUND", message: "Dinner not found" });
  const before = new Map(items.map((item) => [item.id, { ...item }]));
  const recentBefore = new Map(
    recentItems.map((item) => [item.ownItemId, item]),
  );
  const ownById = new Map(ownItems.map((item) => [item.id, item]));
  const ownByIdentity = new Map(
    ownItems.map((item) => [shoppingIdentity(item.name, item.note), item]),
  );
  const catalog = shoppingCatalog.map((item) => ({
    name: item[household.shoppingLanguage],
    note: null,
    category: item.category,
  }));
  const sources: ShoppingSource[] = [...ownItems, ...catalog];
  const newOwnItems: OwnItem[] = [];
  const requirements = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const group = requirements.get(item.ownItemId) ?? [];
    group.push(item);
    requirements.set(item.ownItemId, group);
  }
  const added = new Map<string, ShoppingItem>();
  const skipped = new Map<
    string,
    { ownItemId: string; amount: number | null; unit: string | null }
  >();
  // Iterate the requested IDs, not the query result: order and repetitions matter.
  for (const dinnerId of dinnerIds) {
    const dinner = dinnersById.get(dinnerId)!;
    const ingredients = dinner.parts.flatMap((part) => part.ingredients);
    for (const item of ingredients.length
      ? ingredients
      : [{ name: dinner.name, amount: null, unit: null }]) {
      const selection = ingredients.length
        ? selectRecipeIngredient(item.name, sources)
        : { name: item.name, note: null };
      let ownItem =
        "ownItemId" in selection
          ? ownById.get(selection.ownItemId)!
          : ownByIdentity.get(shoppingIdentity(selection.name, selection.note));
      if (!ownItem && "name" in selection) {
        const source = selection.source;
        const category =
          source &&
          ("ownItemId" in source
            ? ownById.get(source.ownItemId)?.category
            : catalog.find(
                (item) =>
                  normalizeShoppingName(item.name) ===
                  normalizeShoppingName(source.standardName),
              )?.category);
        const trimmedNote = selection.note?.trim();
        const note = trimmedNote === "" ? null : (trimmedNote ?? null);
        ownItem = {
          id: crypto.randomUUID(),
          householdId,
          name: capitalizeShoppingName(selection.name),
          note,
          normalizedName: normalizeShoppingName(selection.name),
          normalizedNote: normalizeShoppingName(note ?? ""),
          category: ownItemCategory(
            household.shoppingLanguage,
            ownById.values(),
            normalizeShoppingName(selection.name),
            category,
          ),
          usuallyHave: false,
          odaProductId: null,
          odaProductName: null,
          odaProductDescription: null,
        };
        newOwnItems.push(ownItem);
        ownById.set(ownItem.id, ownItem);
        ownByIdentity.set(shoppingIdentity(ownItem.name, note), ownItem);
        sources.push(ownItem);
      }
      if (!ownItem) throw new Error("Could not resolve Dinner ingredient");
      const quantity = {
        ownItemId: ownItem.id,
        amount: item.amount,
        unit: normalizeUnit(item.unit),
      };
      if (ownItem.usuallyHave) {
        skipped.set(ownItem.id, quantity);
        continue;
      }
      const group = requirements.get(ownItem.id) ?? [];
      let destination;
      for (const existing of group) {
        const combined = combineShoppingQuantity(existing, quantity);
        if (!combined) continue;
        const { amount } = combined;
        if (amount !== existing.amount) {
          existing.amount = amount;
          existing.revision = crypto.randomUUID();
        }
        destination = existing;
        break;
      }
      if (!destination) {
        destination = {
          id: crypto.randomUUID(),
          householdId,
          ...quantity,
          revision: crypto.randomUUID(),
        };
        group.push(destination);
        requirements.set(ownItem.id, group);
      }
      added.set(destination.id, destination);
    }
  }
  if (newOwnItems.length) await tx.ownItem.createMany({ data: newOwnItems });
  if (added.size)
    await tx.odaTransfer.updateMany({
      where: { householdId, state: "COMPLETED", dismissed: false },
      data: { dismissed: true },
    });
  let changed = [...added.values()].filter(
    (item) => before.get(item.id)?.revision !== item.revision,
  );
  const created = changed.filter((item) => !before.has(item.id));
  if (created.length) {
    // Let Prisma assign ordered CUIDs, as with manual additions. IDs break ties
    // between requirements for the same Own Item in the Shopping List.
    const saved = await tx.shoppingItem.createManyAndReturn({
      data: created.map(
        ({ householdId, ownItemId, amount, unit, revision }) => ({
          householdId,
          ownItemId,
          amount,
          unit,
          revision,
        }),
      ),
    });
    const byRevision = new Map(saved.map((item) => [item.revision, item]));
    changed = changed.map((item) => byRevision.get(item.revision) ?? item);
  }
  for (const item of changed) {
    if (!before.has(item.id)) continue;
    await tx.shoppingItem.update({
      where: { householdId, id: item.id },
      data: { amount: item.amount, revision: item.revision },
    });
  }
  const recentlyUsedAt = new Date(
    Math.max(
      Date.now(),
      ...recentItems.map((item) => item.recentlyUsedAt.getTime() + 1),
    ),
  );
  const recent = [...skipped.values()].map((item) => ({
    ...item,
    householdId,
    id: recentBefore.get(item.ownItemId)?.id ?? crypto.randomUUID(),
    recentlyUsedAt,
    revision: crypto.randomUUID(),
  }));
  const newRecent = recent.filter((item) => !recentBefore.has(item.ownItemId));
  if (newRecent.length)
    await tx.recentShoppingItem.createMany({ data: newRecent });
  for (const item of recent) {
    if (!recentBefore.has(item.ownItemId)) continue;
    await tx.recentShoppingItem.update({
      where: { householdId, id: item.id },
      data: {
        amount: item.amount,
        unit: item.unit,
        recentlyUsedAt,
        revision: item.revision,
      },
    });
  }
  return {
    undo: {
      recent: recent.map(({ id, ownItemId, revision }) => ({
        id,
        ownItemId,
        revision,
        before: recentBefore.get(ownItemId) ?? null,
      })),
      items: changed.map(({ id, ownItemId, revision }) => ({
        id,
        ownItemId,
        revision,
        before: before.get(id) ?? null,
      })),
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
