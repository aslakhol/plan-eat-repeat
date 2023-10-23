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

  tags: publicProcedure.query(({ ctx }) => {
    const tags = ctx.db.tag.findMany();
    return {
      tags: tags,
    };
  }),
});
