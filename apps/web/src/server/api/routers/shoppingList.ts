import { addDinnersToShoppingList } from "../../shopping-dinner-additions";
import { odaProductPreferenceSchema } from "~/lib/oda-product";
import {
  shoppingSources,
  resolveShoppingSelection,
} from "../../shopping-suggestions";
import {
  shoppingCategoryOrder,
  shoppingCategories,
} from "@planeatrepeat/shared";
import { shoppingItemDetails } from "../../own-items";
import { z } from "zod";
import { type Prisma, ShoppingCategory } from "@planeatrepeat/db";
import {
  saveShoppingItem,
  saveShoppingItemWithMerges,
  setUsuallyHave,
} from "../../shopping-list";
import {
  editRecentShoppingItem,
  rememberShoppingItems,
  readRecentShoppingItems,
} from "../../recent-shopping-items";
import { createTRPCRouter, protectedProcedureWithHousehold } from "../trpc";

const itemFields = z.object({
  name: z.string().trim().min(1, "Enter an item name"),
  amount: z.number().finite().positive().nullable(),
  unit: z.string().nullable(),
  note: z
    .string()
    .trim()
    .nullable()
    .transform((note) => (note === "" ? null : note)),
});

// An edit may change several requirements and delete their former identities.
async function shoppingEditResult(
  tx: Prisma.TransactionClient,
  householdId: string,
  originalOwnItemId: string,
  {
    item: saved,
    mergedIds,
  }: Awaited<ReturnType<typeof saveShoppingItemWithMerges>>,
) {
  const affectedOwnItemIds = [...new Set([originalOwnItemId, saved.ownItemId])];
  const where = { householdId, ownItemId: { in: affectedOwnItemIds } };
  const [items, recentItems] = await Promise.all([
    tx.shoppingItem.findMany({ where, include: { ownItem: true } }),
    tx.recentShoppingItem.findMany({ where, include: { ownItem: true } }),
  ]);
  return {
    ...saved,
    mergedIds,
    affectedOwnItemIds,
    items: items.map(shoppingItemDetails),
    recentItems: recentItems.map(shoppingItemDetails),
  };
}

export const shoppingListRouter = createTRPCRouter({
  categories: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const { shoppingLanguage } = await ctx.db.household.findUniqueOrThrow({
      where: { id: ctx.householdId },
      select: { shoppingLanguage: true },
    });
    return shoppingCategoryOrder.map((id) => ({
      id,
      label: shoppingCategories[id][shoppingLanguage],
    }));
  }),

  editRecent: protectedProcedureWithHousehold
    .input(
      itemFields.extend({
        id: z.string(),
        usuallyHave: z.boolean().optional(),
        category: z.nativeEnum(ShoppingCategory).optional(),
        odaProduct: odaProductPreferenceSchema.nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const original = await tx.recentShoppingItem.findUniqueOrThrow({
          where: { id: input.id, householdId: ctx.householdId },
        });
        const saved = await editRecentShoppingItem(tx, ctx.householdId, input);
        const result = await shoppingEditResult(
          tx,
          ctx.householdId,
          original.ownItemId,
          saved,
        );
        return {
          ...result,
          mergedIds: { ...result.mergedIds, [input.id]: saved.item.id },
        };
      }),
    ),

  removeRecent: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        return tx.recentShoppingItem.deleteMany({
          where: { id: input.id, householdId: ctx.householdId },
        });
      }),
    ),

  recent: protectedProcedureWithHousehold.query(({ ctx }) =>
    readRecentShoppingItems(ctx.db, ctx.householdId),
  ),

  addRecent: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const recent = await tx.recentShoppingItem.findUniqueOrThrow({
          where: { id: input.id, householdId: ctx.householdId },
          include: { ownItem: true },
        });
        const active = await tx.shoppingItem.findFirst({
          where: { householdId: ctx.householdId, ownItemId: recent.ownItemId },
          include: { ownItem: true },
        });
        if (active) return shoppingItemDetails(active);
        const saved = await saveShoppingItem(tx, ctx.householdId, {
          name: recent.ownItem.name,
          note: recent.ownItem.note,
          amount: recent.amount,
          unit: recent.unit,
        });
        await tx.recentShoppingItem.update({
          where: { id: recent.id, householdId: ctx.householdId },
          data: { revision: crypto.randomUUID() },
        });
        return saved;
      }),
    ),

  list: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const items = await ctx.db.shoppingItem.findMany({
      where: { householdId: ctx.householdId },
      include: { ownItem: true },
    });
    return items
      .map(shoppingItemDetails)
      .sort(
        (a, b) =>
          shoppingCategoryOrder.indexOf(a.ownItem.category) -
            shoppingCategoryOrder.indexOf(b.ownItem.category) ||
          a.normalizedName.localeCompare(b.normalizedName) ||
          a.ownItem.normalizedNote.localeCompare(b.ownItem.normalizedNote) ||
          a.id.localeCompare(b.id),
      );
  }),

  usuallyHave: protectedProcedureWithHousehold.query(({ ctx }) =>
    ctx.db.ownItem.findMany({
      where: { householdId: ctx.householdId, usuallyHave: true },
      orderBy: [{ normalizedName: "asc" }, { normalizedNote: "asc" }],
    }),
  ),

  setUsuallyHave: protectedProcedureWithHousehold
    .input(
      z.union([
        z.object({ id: z.string(), excluded: z.boolean() }),
        z.object({
          name: z.string().trim().min(1),
          note: z.string().nullable().optional(),
          excluded: z.boolean(),
        }),
      ]),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        setUsuallyHave(tx, ctx.householdId, input, input.excluded),
      ),
    ),

  sources: protectedProcedureWithHousehold.query(({ ctx }) =>
    shoppingSources(ctx.db, ctx.householdId),
  ),

  addSelection: protectedProcedureWithHousehold
    .input(
      z.union([
        z.object({ ownItemId: z.string() }),
        z.object({
          name: z.string().trim().min(1),
          note: z.string().nullable(),
          source: z
            .union([
              z.object({ ownItemId: z.string() }),
              z.object({ standardName: z.string() }),
            ])
            .optional(),
        }),
      ]),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const ownItem = await resolveShoppingSelection(
          tx,
          ctx.householdId,
          input,
        );
        return saveShoppingItem(tx, ctx.householdId, {
          name: ownItem.name,
          note: ownItem.note,
          amount: null,
          unit: null,
        });
      }),
    ),

  addManual: protectedProcedureWithHousehold
    .input(z.object({ name: z.string().trim().min(1, "Enter an item name") }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) =>
        saveShoppingItem(tx, ctx.householdId, {
          name: input.name,
          amount: null,
          unit: null,
          note: null,
        }),
      ),
    ),

  addDinners: protectedProcedureWithHousehold
    .input(
      z.object({
        operationId: z
          .string()
          .uuid()
          .default(() => crypto.randomUUID()),
        dinnerIds: z.array(z.number().int().positive()).min(1),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        return addDinnersToShoppingList(tx, ctx.householdId, input);
      }),
    ),

  undo: protectedProcedureWithHousehold
    .input(
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            ownItemId: z.string(),
            revision: z.string(),
            before: z
              .object({
                amount: z.number().nullable(),
                unit: z.string().nullable(),
                revision: z.string(),
              })
              .nullable(),
          }),
        ),
        recent: z
          .array(
            z.object({
              id: z.string(),
              ownItemId: z.string(),
              revision: z.string(),
              before: z
                .object({
                  amount: z.number().nullable(),
                  unit: z.string().nullable(),
                  recentlyUsedAt: z.date(),
                  revision: z.string(),
                })
                .nullable(),
            }),
          )
          .default([]),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        for (const { before, ...after } of input.items) {
          const where = { ...after, householdId: ctx.householdId };
          if (before) await tx.shoppingItem.updateMany({ where, data: before });
          else await tx.shoppingItem.deleteMany({ where });
        }
        for (const { before, ...after } of input.recent) {
          const where = { ...after, householdId: ctx.householdId };
          if (before)
            await tx.recentShoppingItem.updateMany({ where, data: before });
          else await tx.recentShoppingItem.deleteMany({ where });
        }
      }),
    ),

  edit: protectedProcedureWithHousehold
    .input(
      itemFields.extend({
        id: z.string(),
        usuallyHave: z.boolean().optional(),
        category: z.nativeEnum(ShoppingCategory).optional(),
        odaProduct: odaProductPreferenceSchema.nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const original = await tx.shoppingItem.findUniqueOrThrow({
          where: { id: input.id, householdId: ctx.householdId },
        });
        const saved = await saveShoppingItemWithMerges(
          tx,
          ctx.householdId,
          input,
        );
        return shoppingEditResult(
          tx,
          ctx.householdId,
          original.ownItemId,
          saved,
        );
      }),
    ),

  deleteOwnItem: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const where = { ownItemId: input.id, householdId: ctx.householdId };
        await tx.shoppingItem.deleteMany({ where });
        await tx.recentShoppingItem.deleteMany({ where });
        return tx.ownItem.deleteMany({
          where: { id: input.id, householdId: ctx.householdId },
        });
      }),
    ),

  remove: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const where = { id: input.id, householdId: ctx.householdId };
        const item = await tx.shoppingItem.findUnique({
          where,
          include: { ownItem: true },
        });
        const [recent] = item
          ? await rememberShoppingItems(tx, ctx.householdId, [item])
          : [];
        const removed = await tx.shoppingItem.deleteMany({ where });
        return {
          ...removed,
          recentItem:
            item && recent
              ? shoppingItemDetails({ ...recent, ownItem: item.ownItem })
              : null,
        };
      }),
    ),

  clear: protectedProcedureWithHousehold
    .input(
      z
        .object({
          items: z.array(z.object({ id: z.string(), revision: z.string() })),
        })
        .optional(),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const where = {
          householdId: ctx.householdId,
          ...(input ? { OR: input.items } : {}),
        };
        const items = await tx.shoppingItem.findMany({
          where,
          orderBy: [
            { ownItem: { normalizedName: "asc" } },
            { ownItem: { normalizedNote: "asc" } },
            { id: "asc" },
          ],
        });
        await rememberShoppingItems(tx, ctx.householdId, items);
        const removed = await tx.shoppingItem.deleteMany({ where });
        const recentItems = await readRecentShoppingItems(tx, ctx.householdId);
        return {
          ...removed,
          removedIds: items.map((item) => item.id),
          recentItems,
        };
      }),
    ),
});
