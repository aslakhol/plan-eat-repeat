import { type RecipeInput } from "@planeatrepeat/shared";

export type RecipeEditorDraftValues = {
  name: string;
  tags: string[];
  newTag?: string;
  link: string;
  notes: string;
  recipe: {
    servings: number | null;
    parts: Array<{
      name: string;
      ingredients: Array<{
        name: string;
        amount: string;
        unit: string | null;
        note: string;
      }>;
      steps: Array<{ text: string }>;
    }>;
  };
};

export const editorValuesFromRecipeInput = (input: {
  name: string;
  recipe: RecipeInput;
  sourceLink?: string | null;
}): RecipeEditorDraftValues => ({
  name: input.name,
  tags: [],
  newTag: "",
  link: input.sourceLink ?? "",
  notes: "",
  recipe: recipeEditorValues(input.recipe),
});

export const recipeEditorValues = (recipe: RecipeInput) => ({
  servings: recipe.servings,
  parts: recipe.parts.map((part) => ({
    name: part.name ?? "",
    ingredients: part.ingredients.map(editorIngredientValues),
    steps: part.steps.map((text) => ({ text })),
  })),
});

export const editorIngredientValues = (ingredient: {
  name: string;
  amount: number | null;
  unit: string | null;
  note: string | null;
}) => ({
  name: ingredient.name,
  amount: ingredient.amount === null ? "" : String(ingredient.amount),
  unit: ingredient.unit,
  note: ingredient.note ?? "",
});
