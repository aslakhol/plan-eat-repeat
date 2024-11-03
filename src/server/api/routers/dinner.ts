import { z } from "zod";

import {
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
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

  dinners: publicProcedure.query(async ({ ctx }) => {
    const dinners: DinnerWithTags[] = await ctx.db.dinner.findMany({
      include: { tags: true },
      orderBy: { name: "asc" },
    });
    return {
      dinners: dinners,
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        dinnerName: z.string().min(3),
        tagList: z.array(z.string()),
        link: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.dinner.create({
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
          },
        },
      });

      return {
        dinner,
      };
    }),
  edit: protectedProcedure
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
        where: { id: input.dinnerId },
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
  delete: protectedProcedure
    .input(z.object({ dinnerId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const dinner = await ctx.db.dinner.delete({
        where: { id: input.dinnerId },
      });

      return {
        dinner,
      };
    }),
});
