import { z } from "zod";

import {
  dinnerLinkSchema,
  dinnerNameSchema,
  recipeSchema,
} from "@planeatrepeat/shared";

export const createDinnerInputSchema = z.object({
  dinnerName: dinnerNameSchema,
  tagList: z.array(z.string()),
  link: dinnerLinkSchema,
  notes: z.string().nullable().optional(),
  recipe: recipeSchema.optional(),
  planDate: z.date().optional(),
});

export const editDinnerInputSchema = z.object({
  dinnerName: dinnerNameSchema,
  dinnerId: z.number(),
  tagList: z.array(z.string()),
  link: dinnerLinkSchema,
  notes: z.string().nullable().optional(),
  recipe: recipeSchema.optional(),
});
