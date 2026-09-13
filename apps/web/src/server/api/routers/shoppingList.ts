import { z } from "zod";
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
      ctx.db.shoppingItem.create({
        data: {
          householdId: ctx.householdId,
          name: input.name,
          normalizedName: input.name.toLowerCase(),
        },
      }),
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
