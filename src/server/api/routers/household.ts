import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";

export const householdRouter = createTRPCRouter({
  household: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const household = await ctx.db.household.findUnique({
        where: { id: input.id },
        include: { Members: true },
      });

      return { household };
    }),
  createHousehold: protectedProcedure
    .input(z.object({ name: z.string(), slug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.db.household.create({
        data: {
          name: input.name,
          slug: input.slug,
          Members: { create: { userId: ctx.auth.userId, role: "ADMIN" } },
        },
        include: { Members: true },
      });
      return { household };
    }),
  updateHousehold: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { id, name } = input;
      const household = await ctx.db.household.update({
        where: { id },
        data: { name },
      });

      return { household };
    }),
});
