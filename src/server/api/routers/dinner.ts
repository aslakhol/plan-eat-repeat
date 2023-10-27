import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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
    const dinners = await ctx.db.dinner.findMany({ include: { tags: true } });
    return {
      dinners: dinners,
    };
  }),
});
