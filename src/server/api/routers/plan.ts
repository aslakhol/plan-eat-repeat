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
      if (!ctx.householdId) {
        return { plans: [] };
      }

      const plans = await ctx.db.plan.findMany({
        where: {
          date: {
            gte: input.startOfWeek,
            lt: addDays(input.startOfWeek, 7),
          },
          dinner: { householdId: ctx.householdId },
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
      const existingPlan = await ctx.db.plan.findFirst({
        where: { date: input.date, dinner: { householdId: ctx.householdId } },
      });
      let newPlan;

      if (existingPlan) {
        newPlan = await ctx.db.plan.update({
          where: { id: existingPlan.id },
          data: { dinnerId: input.dinnerId },
        });

        return { newPlan };
      }

      newPlan = await ctx.db.plan.create({
        data: { date: input.date, dinnerId: input.dinnerId },
      });

      return { newPlan };
    }),

  unplanDay: protectedProcedure
    .input(z.object({ date: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const { date } = input;
      const deleted = await ctx.db.plan.deleteMany({
        where: { date, dinner: { householdId: ctx.householdId } },
      });

      return { deleted };
    }),
  plansForDinner: publicProcedure
    .input(z.object({ dinnerId: z.number() }))
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db.plan.findMany({
        where: { dinnerId: input.dinnerId },
        orderBy: { date: "desc" },
      });
      return { plans };
    }),
});
