export const importRecipeErrorCodes = [
  "FETCH_FAILED",
  "SITE_BLOCKED",
  "PAGE_UNREADABLE",
  "NO_RECIPE_FOUND",
  "EXTRACTION_FAILED",
] as const;

export type ImportRecipeErrorCode = (typeof importRecipeErrorCodes)[number];

// The server sends the code in the TRPCError message; anything unexpected
// collapses to the generic extraction failure.
export const importErrorCodeFromMessage = (
  message: string,
): ImportRecipeErrorCode =>
  (importRecipeErrorCodes as readonly string[]).includes(message)
    ? (message as ImportRecipeErrorCode)
    : "EXTRACTION_FAILED";

export const importErrorMessages: Record<ImportRecipeErrorCode, string> = {
  FETCH_FAILED:
    "We couldn't open that link. Double-check the URL, or paste the recipe text below.",
  SITE_BLOCKED:
    "This site blocks automated requests, so we couldn't read it. Paste the recipe text below and we'll structure it for you.",
  PAGE_UNREADABLE:
    "We couldn't read this page automatically — some sites build their recipe with JavaScript, so there's nothing on the page for us to grab. Paste the recipe text below and we'll structure it for you.",
  NO_RECIPE_FOUND:
    "We opened the page but couldn't find a recipe on it. If there is one, paste the text below.",
  EXTRACTION_FAILED:
    "We couldn't turn that source into a recipe. Try pasting the recipe text below.",
};

export const validUrlOrNull = (value: string) => {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return null;
  }
};
