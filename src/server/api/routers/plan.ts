import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";

export const planRouter = createTRPCRouter({
  plannedDinners: publicProcedure
    .input(z.object({ startOfWeek: z.date() }))
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db.plan.findMany({
        where: {
          date: { gte: input.startOfWeek, lt: addDays(input.startOfWeek, 7) },
        },
        include: { dinner: { include: { tags: true } } },
        orderBy: { date: "asc" },
      });

      return { plans };
    }),
  planDinnerForDate: protectedProcedure
    .input(
      z.object({
        dinnerId: z.number(),
        date: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const newPlan = await ctx.db.plan.upsert({
        where: { date: input.date },
        create: { date: input.date, dinnerId: input.dinnerId },
        update: { dinnerId: input.dinnerId },
      });

      return { newPlan };
    }),

  unplanDay: protectedProcedure
    .input(z.object({ date: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const { date } = input;
      const deleted = await ctx.db.plan.delete({ where: { date } });

      return { deleted };
    }),
});
