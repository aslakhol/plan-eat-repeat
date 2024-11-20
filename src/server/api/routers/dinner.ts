import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedureWithHousehold,
} from "~/server/api/trpc";
import { type DinnerWithTags } from "~/utils/types";

export const dinnerRouter = createTRPCRouter({
  tags: publicProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.tag.findMany({
      orderBy: { value: "asc" },
      include: { _count: true },
    });
    return {
      tags: tags.filter((tag) => tag._count.Dinner > 0),
    };
  }),

  dinners: protectedProcedureWithHousehold.query(async ({ ctx }) => {
    const householdId = ctx.householdId;

    const dinners: DinnerWithTags[] = await ctx.db.dinner.findMany({
      where: { householdId },
      include: { tags: true },
      orderBy: { name: "asc" },
    });
    return {
      dinners: dinners,
    };
  }),

  create: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerName: z.string().min(3),
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const householdId = ctx.householdId;

      const dinner = await ctx.db.dinner.create({
        data: {
          name: input.dinnerName,
          link: input.link,
          notes: input.notes,
          householdId,
          tags: {
            connectOrCreate: input.tagList.map((tag) => {
              return {
                where: { value: tag },
                create: { value: tag },
              };
            }),
          },
        },
      });

      return {
        dinner,
      };
    }),
  edit: protectedProcedureWithHousehold
    .input(
      z.object({
        dinnerName: z.string().min(3),
        dinnerId: z.number(),
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const previousDinner = await ctx.db.dinner.findUnique({
        where: { id: input.dinnerId },
        include: { tags: true },
      });

      const tagsToRemove = previousDinner?.tags.filter(
        (tag) => !input.tagList.includes(tag.value),
      );

      const dinner = await ctx.db.dinner.update({
        where: { id: input.dinnerId, householdId: ctx.householdId },
        data: {
          name: input.dinnerName,
          link: input.link,
          notes: input.notes,
          tags: {
            connectOrCreate: input.tagList.map((tag) => {
              return {
                where: { value: tag },
                create: { value: tag },
              };
            }),
            disconnect: tagsToRemove,
          },
        },
      });

      return {
        dinner,
      };
    }),
  delete: protectedProcedureWithHousehold
    .input(z.object({ dinnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.dinner.delete({
        where: { id: input.dinnerId, householdId: ctx.householdId },
      });

      return {
        dinner,
      };
    }),
});
