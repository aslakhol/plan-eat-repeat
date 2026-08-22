import { z } from "zod";

import {
  dinnerLinkSchema,
  dinnerNameSchema,
  recipeSchema,
} from "@planeatrepeat/shared";

const dinnerInputSchema = z.object({
  dinnerName: dinnerNameSchema,
  tagList: z.array(z.string()),
  link: dinnerLinkSchema,
  notes: z.string().nullable().optional(),
  recipe: recipeSchema.optional(),
});

export const createDinnerInputSchema = dinnerInputSchema.extend({
  planDate: z.date().optional(),
});

export const editDinnerInputSchema = dinnerInputSchema.extend({
  dinnerId: z.number(),
});
