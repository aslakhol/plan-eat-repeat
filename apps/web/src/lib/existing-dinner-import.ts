import type { RecipeInput, Unit } from "@planeatrepeat/shared";

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
  link?: string | null;
}): ExistingDinnerEditorValues => ({
  name: input.name,
  tags: [],
  newTag: "",
  link: input.link ?? "",
  notes: "",
  recipe: recipeEditorValues(input.recipe),
});

const recipeEditorValues = (recipe: RecipeInput) => ({
  servings: recipe.servings,
  parts: recipe.parts.map((part) => ({
    name: part.name ?? "",
    ingredients: part.ingredients.map((ingredient) => ({
      name: ingredient.name,
      amount: ingredient.amount === null ? "" : String(ingredient.amount),
      unit: ingredient.unit,
      note: ingredient.note ?? "",
    })),
    steps: part.steps.map((text) => ({ text })),
  })),
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
