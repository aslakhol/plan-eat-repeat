import { date, z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type DinnerWithTags } from "../../../utils/types";
import { type Dinner } from "@prisma/client";

export const dinnerRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  tags: publicProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.tag.findMany();
    return {
      tags: tags,
    };
  }),

  //Gets stuff from DB
  dinners: publicProcedure.query(async ({ ctx }) => {
    const dinners: DinnerWithTags[] = await ctx.db.dinner.findMany({
      include: { tags: true },
    });
    return {
      dinners: dinners,
    };
  }),

  weekPlan: publicProcedure.query(async ({ ctx }) => {
    const plannedDinners = await ctx.db.dinner.findMany({
      where: { plannedForDay: { not: null } },
    });

    const week = [0, 1, 2, 3, 4, 5, 6].map((day) => {
      return plannedDinners.find((dinner) => dinner.plannedForDay === day);
    });

    return {
      week,
    };
  }),

  toggle: publicProcedure
    .input(z.object({ dinnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
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

      const updatedDinner = ctx.db.dinner.update({
        where: { id: input.dinnerId },
        data: { plannedForDay: firstAvailableDay },
      });

      return {
        updatedDinner,
      };
    }),
});

const getFirstAvailableDay = (plannedDinners: Dinner[]): number | undefined => {
  const plannedForDays = plannedDinners.map((dinner) => dinner.plannedForDay!);

  const firstAvailableDay = [0, 1, 2, 3, 4, 5, 6].find(
    (day) => !plannedForDays.includes(day),
  );

  return firstAvailableDay;
};
