import { z } from "zod";

export const UNITS = ["g", "kg", "ml", "dl", "l", "ss", "ts", "stk"] as const;
export type Unit = (typeof UNITS)[number];

export const recipeIngredientSchema = z.object({
  name: z.string().trim().min(1),
  amount: z.number().positive().nullable(),
  unit: z.enum(UNITS).nullable(),
  note: z.string().trim().min(1).nullable(),
});

export const recipePartSchema = z.object({
  name: z.string().trim().min(1).nullable(),
  ingredients: z.array(recipeIngredientSchema),
  steps: z.array(z.string().trim().min(1)),
});

export const recipeSchema = z.object({
  servings: z.number().int().positive().nullable(),
  parts: z.array(recipePartSchema),
});

export type RecipeInput = z.infer<typeof recipeSchema>;

export const formatAmount = (amount: number) => String(amount);
