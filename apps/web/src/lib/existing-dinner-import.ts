import type { RecipeInput } from "@planeatrepeat/shared";

import { importNameConflict, importSourceLinkConflict } from "./url-import";
import {
  recipeEditorValues,
  type RecipeEditorDraftValues,
} from "./recipe-editor-values";

export type ExistingDinnerRecipeImport = {
  name: string;
  recipe: RecipeInput;
  sourceLink: string | null;
};

export const clearExistingDinnerRecipe = (
  existing: RecipeEditorDraftValues,
): RecipeEditorDraftValues => ({
  ...existing,
  recipe: { servings: null, parts: [] },
});

export const applyExistingDinnerImport = (
  existing: RecipeEditorDraftValues,
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
