import { z } from "zod";

export const UNITS = [
  "g",
  "kg",
  "ml",
  "dl",
  "l",
  "tbsp",
  "tsp",
  "pcs",
] as const;
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

// Editors keep amounts as text so partial input like "1," or "0.5" survives
// re-renders and comma decimals work; parseAmount converts back on save.
export const parseAmount = (value: string) => {
  const normalized = value.trim().replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

export const amountInputSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true;
    const parsed = Number(value.replace(",", "."));
    return !Number.isNaN(parsed) && parsed > 0;
  }, "Amount must be a number more than 0");
