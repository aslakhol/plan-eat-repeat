import { z } from "zod";
import type { ShoppingItem } from "@planeatrepeat/db";
import { saveShoppingItem } from "../../shopping-list";
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

export const shoppingListRouter = createTRPCRouter({
  list: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const items = await ctx.db.shoppingItem.findMany({
      where: { householdId: ctx.householdId },
    });
    return items.sort(
      (a, b) =>
        a.normalizedName.localeCompare(b.normalizedName) ||
        a.id.localeCompare(b.id),
    );
  }),

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
    .input(z.object({ dinnerIds: z.array(z.number().int().positive()).min(1) }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        const before = new Map(
          (
            await tx.shoppingItem.findMany({
              where: { householdId: ctx.householdId },
            })
          ).map((item) => [item.id, item]),
        );
        const added = new Map<string, ShoppingItem>();
        for (const dinnerId of input.dinnerIds) {
          const dinner = await tx.dinner.findUniqueOrThrow({
            where: { id: dinnerId, householdId: ctx.householdId },
            include: { parts: { include: { ingredients: true } } },
          });
          const ingredients = dinner.parts.flatMap((part) => part.ingredients);
          const requirements =
            ingredients.length > 0
              ? ingredients
              : [{ name: dinner.name, amount: null, unit: null }];
          for (const item of requirements) {
            const saved = await saveShoppingItem(tx, ctx.householdId, {
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              note: null,
            });
            added.set(saved.id, saved);
          }
        }
        return {
          undo: {
            items: [...added.values()].flatMap(
              ({ id, name, amount, unit, note }) => {
                const original = before.get(id);
                if (original?.amount === amount && original.note === note)
                  return [];
                return [
                  {
                    id,
                    name,
                    amount,
                    unit,
                    note,
                    before: original
                      ? { amount: original.amount, note: original.note }
                      : null,
                  },
                ];
              },
            ),
          },
        };
      }),
    ),

  undo: protectedProcedureWithHousehold
    .input(
      z.object({
        items: z.array(
          itemFields.extend({
            id: z.string(),
            before: itemFields.pick({ amount: true, note: true }).nullable(),
          }),
        ),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Household" WHERE id = ${ctx.householdId} FOR UPDATE`;
        for (const { before, ...after } of input.items) {
          // Leave requirements edited or removed since this addition alone.
          const where = { ...after, householdId: ctx.householdId };
          if (before) {
            await tx.shoppingItem.updateMany({ where, data: before });
          } else {
            await tx.shoppingItem.deleteMany({ where });
          }
        }
      }),
    ),

  edit: protectedProcedureWithHousehold
    .input(itemFields.extend({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.$transaction((tx) => saveShoppingItem(tx, ctx.householdId, input)),
    ),

  remove: protectedProcedureWithHousehold
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.shoppingItem.deleteMany({
        where: { id: input.id, householdId: ctx.householdId },
      }),
    ),

  clear: protectedProcedureWithHousehold.mutation(({ ctx }) =>
    ctx.db.shoppingItem.deleteMany({
      where: { householdId: ctx.householdId },
    }),
  ),
});
