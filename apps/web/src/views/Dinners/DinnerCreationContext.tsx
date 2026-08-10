import { createContext, useContext } from "react";

import type { EditorNavigation } from "~/lib/editor-navigation";
import type { RecipeEditorValues } from "~/views/Dinners/RecipeEditor";

export type DinnerCreationNavigation = Pick<
  EditorNavigation,
  "origin" | "date"
>;

export type ImportedDinnerDraft = {
  values: RecipeEditorValues;
  importedNameAlternative: string | null;
};

type DinnerCreationContextValue = {
  importedDraft: ImportedDinnerDraft | null;
  openAddDinner: (navigation: DinnerCreationNavigation) => void;
  setImportedDraft: (draft: ImportedDinnerDraft | null) => void;
};

export const DinnerCreationContext =
  createContext<DinnerCreationContextValue | null>(null);

export const useDinnerCreation = () => {
  const context = useContext(DinnerCreationContext);
  if (!context) {
    throw new Error("DinnerCreationContext is missing");
  }
  return context;
};
