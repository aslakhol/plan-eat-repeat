import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { type DinnerWithTags } from "../../../utils/types";
import { env } from "../../../env.mjs";

export const dinnerRouter = createTRPCRouter({
  tags: publicProcedure.query(async ({ ctx }) => {
    const tags = await ctx.db.tag.findMany({ orderBy: { value: "asc" } });
    return {
      tags: tags,
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

  create: publicProcedure
    .input(
      z.object({
        dinnerName: z.string().min(3),
        secret: z.string().nullable(),
        tagList: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const dinner = await ctx.db.dinner.create({
        data: {
          name: input.dinnerName,
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
  edit: publicProcedure
    .input(
      z.object({
        dinnerName: z.string().min(3),
        dinnerId: z.number(),
        secret: z.string().nullable(),
        tagList: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }
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
  delete: publicProcedure
    .input(z.object({ dinnerId: z.number(), secret: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (env.SECRET_PHRASE !== input.secret) {
        throw new Error("Missing secret keyword");
      }

      const dinner = await ctx.db.dinner.delete({
        where: { id: input.dinnerId },
      });

      return {
        dinner,
      };
    }),
});
