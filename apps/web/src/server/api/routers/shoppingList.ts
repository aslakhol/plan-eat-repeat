import { z } from "zod";
import { normalizeUnit } from "@planeatrepeat/shared";
import { addShoppingItem } from "../../shopping-list";
import { createTRPCRouter, protectedProcedureWithHousehold } from "../trpc";

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
        addShoppingItem(tx, ctx.householdId, input.name),
      ),
    ),

  edit: protectedProcedureWithHousehold
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1, "Enter an item name"),
        amount: z.number().finite().positive().nullable(),
        unit: z.string().nullable().transform(normalizeUnit),
        note: z
          .string()
          .trim()
          .nullable()
          .transform((note) => (note === "" ? null : note)),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...item } = input;
      return ctx.db.shoppingItem.update({
        where: { id, householdId: ctx.householdId },
        data: { ...item, normalizedName: item.name.toLowerCase() },
      });
    }),

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
