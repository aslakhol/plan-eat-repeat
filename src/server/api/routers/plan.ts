import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { env } from "../../../env.mjs";
import { addDays } from "date-fns";

export const planRouter = createTRPCRouter({
  plannedDinners: publicProcedure
    .input(z.object({ startOfWeek: z.date() }))
    .query(async ({ ctx, input }) => {
      const plans = await ctx.db.plan.findMany({
        where: {
          date: { gte: input.startOfWeek, lt: addDays(input.startOfWeek, 7) },
        },
        include: { dinner: true },
        orderBy: { date: "asc" },
      });

      return { plans };
    }),
  planDinnerForDate: publicProcedure
    .input(
      z.object({
        dinnerId: z.number(),
        date: z.date(),
        secret: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const newPlan = await ctx.db.plan.upsert({
        where: { date: input.date },
        create: { date: input.date, dinnerId: input.dinnerId },
        update: { dinnerId: input.dinnerId },
      });

      return { newPlan };
    }),

  unplanDay: publicProcedure
    .input(z.object({ date: z.date(), secret: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { date, secret } = input;

      if (env.SECRET_PHRASE !== secret) {
        throw new Error("Missing secret keyword");
      }

      const deleted = await ctx.db.plan.delete({ where: { date: date } });

      return { deleted };
    }),
});
