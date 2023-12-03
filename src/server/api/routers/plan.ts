import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type DinnerWithTags } from "../../../utils/types";
import { getFirstAvailableDay } from "../../../utils/dinner";
import { env } from "../../../env.mjs";

export const planRouter = createTRPCRouter({
  // planDinnerForDay
  // unplanDay
  // unplanDinner

  toggle: publicProcedure
    .input(z.object({ dinnerId: z.number(), secret: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const plannedDinners = await ctx.db.dinner.findMany({
        where: { plannedForDay: { not: null } },
      });

      const toggledDinnerIsPlanned = plannedDinners.some(
        (d) => d.id === input.dinnerId,
      );
      if (toggledDinnerIsPlanned) {
        const updatedDinner = await ctx.db.dinner.update({
          where: { id: input.dinnerId },
          data: { plannedForDay: null },
        });

        return { updatedDinner };
      }

      const firstAvailableDay = getFirstAvailableDay(plannedDinners);

      if (firstAvailableDay === undefined) {
        return { updatedDinner: null };
      }

      const updatedDinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId },
        data: { plannedForDay: firstAvailableDay },
      });

      return {
        updatedDinner,
      };
    }),

  unselect: publicProcedure
    .input(z.object({ dinnerId: z.number(), secret: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const updatedDinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId },
        data: { plannedForDay: null },
      });

      return { updatedDinner };
    }),

  clearDay: publicProcedure
    .input(z.object({ day: z.number(), secret: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const updatedDinner = await ctx.db.dinner.update({
        where: { plannedForDay: input.day },
        data: { plannedForDay: null },
      });

      return { updatedDinner };
    }),

  planForEmptyDay: publicProcedure
    .input(
      z.object({
        dinnerId: z.number(),
        day: z.number(),
        secret: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const updatedDinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId },
        data: { plannedForDay: input.day },
      });

      return { updatedDinner };
    }),

  replacePlanned: publicProcedure
    .input(
      z.object({
        dinnerId: z.number(),
        day: z.number(),
        secret: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const [removedDinner, updatedDinner] = await ctx.db.$transaction([
        ctx.db.dinner.update({
          where: { plannedForDay: input.day },
          data: { plannedForDay: null },
        }),
        ctx.db.dinner.update({
          where: { id: input.dinnerId },
          data: { plannedForDay: input.day },
        }),
      ]);

      console.log({ removedDinner, updatedDinner });

      return { removedDinner, updatedDinner };
    }),
});
