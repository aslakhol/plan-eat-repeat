import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type DinnerWithTags } from "../../../utils/types";
import { getFirstAvailableDay } from "../../../utils/dinner";
import { env } from "../../../env.mjs";

export const planRouter = createTRPCRouter({
  planDinnerForDay: publicProcedure
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

      const dinnerPlannedForDay = await ctx.db.dinner.findUnique({
        where: { plannedForDay: input.day },
      });

      if (dinnerPlannedForDay !== null) {
        const [unplannedDinner, plannedDinner] = await ctx.db.$transaction([
          ctx.db.dinner.update({
            where: { plannedForDay: input.day },
            data: { plannedForDay: null },
          }),
          ctx.db.dinner.update({
            where: { id: input.dinnerId },
            data: { plannedForDay: input.day },
          }),
        ]);

        return { unplannedDinner, plannedDinner };
      }

      const plannedDinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId },
        data: { plannedForDay: input.day },
      });

      return { plannedDinner, unplannedDinner: null };
    }),

  unplanDay: publicProcedure
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

  unplanDinner: publicProcedure
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
});
