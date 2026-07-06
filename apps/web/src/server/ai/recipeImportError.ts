export const RECIPE_IMPORT_ERROR_CODES = [
  "FETCH_FAILED",
  "NO_RECIPE_FOUND",
  "EXTRACTION_FAILED",
] as const;

export type RecipeImportErrorCode = (typeof RECIPE_IMPORT_ERROR_CODES)[number];

export class RecipeImportError extends Error {
  constructor(
    readonly importCode: RecipeImportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RecipeImportError";
  }
}
