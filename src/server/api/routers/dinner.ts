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
});
