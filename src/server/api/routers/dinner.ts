import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type DinnerWithTags } from "../../../utils/types";
import { getFirstAvailableDay } from "../../../utils/dinner";
import { env } from "../../../env.mjs";

export const dinnerRouter = createTRPCRouter({
  tags: publicProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.tag.findMany({ orderBy: { value: "asc" } });
    return {
      tags: tags,
    };
  }),

  //Gets stuff from DB
  dinners: publicProcedure.query(async ({ ctx }) => {
    const dinners: DinnerWithTags[] = await ctx.db.dinner.findMany({
      include: { tags: true },
      orderBy: { name: "asc" },
    });
    return {
      dinners: dinners,
    };
  }),

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

  create: publicProcedure
    .input(
      z.object({
        dinnerName: z.string().min(3),
        secret: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const dinner = await ctx.db.dinner.create({
        data: {
          name: input.dinnerName,
        },
      });

      return {
        dinner,
      };
    }),
});
