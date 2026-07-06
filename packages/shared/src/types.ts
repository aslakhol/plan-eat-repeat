import { z } from "zod";
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

export const dinnerNameSchema = z.string().trim().min(1, "Add a dinner name");
