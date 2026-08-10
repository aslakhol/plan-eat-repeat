import {
  type ImportRecipeErrorCode,
  isImportRecipeErrorCode,
  isYouTubeVideoUrl,
  sourceLabel,
} from "@planeatrepeat/shared";

export type UrlImportErrorCopy = {
  title: string;
  body: string;
};

export const importErrorCodeFromUnknown = (
  error: unknown,
): ImportRecipeErrorCode => {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return "EXTRACTION_FAILED";
  }
  const data = error.data;
  if (
    typeof data !== "object" ||
    data === null ||
    !("importErrorCode" in data)
  ) {
    return "EXTRACTION_FAILED";
  }
  return isImportRecipeErrorCode(data.importErrorCode)
    ? data.importErrorCode
    : "EXTRACTION_FAILED";
};

const normalizedName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLocaleLowerCase();

export const importNameConflict = (
  typedName: string | undefined,
  importedName: string,
) => {
  const trimmedTypedName = typedName?.trim();
  if (
    !trimmedTypedName ||
    normalizedName(trimmedTypedName) === normalizedName(importedName)
  ) {
    return null;
  }
  return importedName;
};

export const urlImportPhases = (url: string) => [
  isYouTubeVideoUrl(url) ? "Fetching the video" : "Fetching the page",
  "Reading the recipe",
  "Structuring it",
];

export const urlImportErrorCopy = (
  code: ImportRecipeErrorCode,
  url: string,
): UrlImportErrorCopy => {
  const video = isYouTubeVideoUrl(url);
  const host = sourceLabel(url);

  switch (code) {
    case "FETCH_FAILED":
      return video
        ? {
            title: "Couldn't reach the video",
            body: "YouTube didn't answer. The video may be unavailable, or your connection dropped.",
          }
        : {
            title: "Couldn't reach the site",
            body: `${host} didn't answer. It may be down, or your connection dropped.`,
          };
    case "SITE_BLOCKED":
      return {
        title: "The site wouldn't let us in",
        body: `${host} blocks automatic reading, so we couldn't reach the recipe.`,
      };
    case "PAGE_UNREADABLE":
      return {
        title: video ? "Couldn't read the video" : "Couldn't read the page",
        body: video
          ? "The video didn't provide enough readable information for a recipe."
          : `${host} didn't provide a page we could read.`,
      };
    case "NO_RECIPE_FOUND":
      return {
        title: "Couldn't find a recipe",
        body: video
          ? "This video doesn't seem to include a readable recipe."
          : `We couldn't find a readable recipe on ${host}.`,
      };
    case "EXTRACTION_FAILED":
      return {
        title: "Couldn't finish the recipe",
        body: "Something went wrong while structuring it. Your link is still here.",
      };
  }
};
