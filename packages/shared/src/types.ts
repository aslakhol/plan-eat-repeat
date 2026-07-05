import { z } from "zod";
import { asOptionalStringWithoutEmpty } from "./zod";
import type {
  Dinner,
  RecipeIngredient,
  RecipePart,
  RecipeStep,
  Tag,
} from "@planeatrepeat/db";

export type DinnerWithTags = Dinner & { tags: Tag[] };
export type DinnerWithRecipe = DinnerWithTags & {
  parts: Array<
    RecipePart & {
      ingredients: RecipeIngredient[];
      steps: RecipeStep[];
    }
  >;
};

export const dinnerNameSchema = z
  .string()
  .trim()
  .min(1, "Add a dinner name");

export const dinnerFormSchema = z.object({
  name: dinnerNameSchema,
  tags: z.array(z.string()),
  newTag: asOptionalStringWithoutEmpty(z.string().max(20).min(1)),
  link: asOptionalStringWithoutEmpty(z.string().url()),
  notes: asOptionalStringWithoutEmpty(z.string()),
});
