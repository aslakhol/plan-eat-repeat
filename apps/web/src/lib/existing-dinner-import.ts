import { UNITS, type RecipeInput, type Unit } from "@planeatrepeat/shared";

import { importNameConflict, importSourceLinkConflict } from "./url-import";

export type ExistingDinnerEditorValues = {
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
        unit: Unit | null;
        note: string;
      }>;
      steps: Array<{ text: string }>;
    }>;
  };
};

export type ExistingDinnerRecipeImport = {
  name: string;
  recipe: RecipeInput;
  sourceLink: string | null;
};

export const editorValuesFromRecipeInput = (input: {
  name: string;
  recipe: RecipeInput;
  sourceLink?: string | null;
}): ExistingDinnerEditorValues => ({
  name: input.name,
  tags: [],
  newTag: "",
  link: input.sourceLink ?? "",
  notes: "",
  recipe: recipeEditorValues(input.recipe),
});

const recipeEditorValues = (recipe: RecipeInput) => ({
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
  unit: UNITS.find((unit) => unit === ingredient.unit) ?? null,
  note: ingredient.note ?? "",
});

export const clearExistingDinnerRecipe = (
  existing: ExistingDinnerEditorValues,
): ExistingDinnerEditorValues => ({
  ...existing,
  recipe: { servings: null, parts: [] },
});

export const applyExistingDinnerImport = (
  existing: ExistingDinnerEditorValues,
  imported: ExistingDinnerRecipeImport,
) => {
  const importedSourceLinkAlternative = importSourceLinkConflict(
    existing.link,
    imported.sourceLink,
  );
  const importedSourceLink = imported.sourceLink;
  const acceptsImportedSourceLink =
    existing.link.trim().length === 0 && importedSourceLink !== null;

  return {
    values: {
      ...existing,
      name: existing.name,
      link: acceptsImportedSourceLink ? importedSourceLink : existing.link,
      recipe: recipeEditorValues(imported.recipe),
    },
    importedNameAlternative: importNameConflict(existing.name, imported.name),
    importedSourceLinkAlternative,
  };
};
