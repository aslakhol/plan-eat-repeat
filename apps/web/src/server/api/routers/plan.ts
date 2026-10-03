import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedureWithHousehold,
  publicProcedure,
} from "~/server/api/trpc";
import { addDays } from "date-fns";
import { TRPCError } from "@trpc/server";

const weekInput = z.object({ startOfWeek: z.date() });

const householdWeek = (
  householdId: string,
  { startOfWeek }: z.infer<typeof weekInput>,
) => ({
  date: { gte: startOfWeek, lt: addDays(startOfWeek, 7) },
  dinner: { householdId },
});

export const planRouter = createTRPCRouter({
  weekOverview: protectedProcedureWithHousehold
    .input(weekInput)
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db.plan.findMany({
        where: householdWeek(ctx.householdId, input),
        select: {
          id: true,
          date: true,
          dinner: { select: { id: true, name: true } },
        },
        orderBy: { date: "asc" },
      });

      return { plans };
    }),
  // Retained for the mobile client, which renders recipes from the week.
  plannedDinners: protectedProcedureWithHousehold
    .input(weekInput)
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db.plan.findMany({
        where: householdWeek(ctx.householdId, input),
        include: {
          dinner: {
            include: {
              tags: true,
              parts: {
                orderBy: { order: "asc" },
                include: {
                  ingredients: { orderBy: { order: "asc" } },
                  steps: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
        orderBy: { date: "asc" },
      });

      return { plans };
    }),
  planDinnerForDate: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerId: z.number(),
        date: z.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const selectedDinner = await ctx.db.dinner.findUnique({
        where: { id: input.dinnerId, householdId: ctx.householdId },
        select: { id: true },
      });
      if (!selectedDinner) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dinner not found" });
      }

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

  unplanDay: protectedProcedureWithHousehold
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
      if (!ctx.householdId) {
        return { plans: [] };
      }

      const plans = await ctx.db.plan.findMany({
        where: {
          dinnerId: input.dinnerId,
          dinner: { householdId: ctx.householdId },
        },
        orderBy: { date: "desc" },
      });
      return { plans };
    }),
});
