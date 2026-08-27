import {
  type ImportRecipeErrorCode,
  isInstagramMediaUrl,
  isImportRecipeErrorCode,
  isYouTubeVideoUrl,
  sourceLabel,
} from "@planeatrepeat/shared";

export type UrlImportErrorCopy = {
  title: string;
  body: string;
};

export type RecipeImportSource =
  | "link"
  | "youtube"
  | "instagram"
  | "photos"
  | "text";

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

const trackingParameterNames = new Set([
  "_ga",
  "_gl",
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "srsltid",
]);

export const normalizeSourceUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
    const port = url.port ? `:${url.port}` : "";
    const pathname = url.pathname.replace(/\/+$/, "");
    const parameters = new URLSearchParams(url.search);

    for (const name of [...parameters.keys()]) {
      const normalizedName = name.toLocaleLowerCase();
      if (
        normalizedName.startsWith("utm_") ||
        trackingParameterNames.has(normalizedName)
      ) {
        parameters.delete(name);
      }
    }
    parameters.sort();

    const query = parameters.toString();
    return `${hostname}${port}${pathname}${query ? `?${query}` : ""}`;
  } catch {
    return value.trim();
  }
};

export const importSourceLinkConflict = (
  existingSourceLink: string,
  importedSourceLink: string | null,
) => {
  const existing = existingSourceLink.trim();
  const imported = importedSourceLink?.trim();
  if (
    !existing ||
    !imported ||
    normalizeSourceUrl(existing) === normalizeSourceUrl(imported)
  ) {
    return null;
  }
  return imported;
};

export const urlImportPhases = (url: string) => [
  isYouTubeVideoUrl(url) || isInstagramMediaUrl(url)
    ? "Fetching the video"
    : "Fetching the page",
  "Reading the recipe",
  "Structuring it",
];

export const urlImportErrorCopy = (
  code: ImportRecipeErrorCode,
  url: string,
): UrlImportErrorCopy => {
  const video = isYouTubeVideoUrl(url) || isInstagramMediaUrl(url);
  const host = sourceLabel(url);

  switch (code) {
    case "FETCH_FAILED":
      return video
        ? {
            title: "Couldn't reach the video",
            body: "The video may be unavailable, or video importing may be temporarily unavailable. Try again later.",
          }
        : {
            title: "Couldn't reach the site",
            body: `${host} didn't answer. It may be down, or your connection dropped.`,
          };
    case "IMPORT_LIMIT_REACHED":
      return {
        title: "Recipe import limit reached",
        body: "We've hit the recipe import limit. Please let Aslak know that we need to upgrade the Supadata plan.",
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

export const importErrorCopy = (
  code: ImportRecipeErrorCode,
  source: RecipeImportSource,
  url = "",
): UrlImportErrorCopy => importSourceCopy[source].error(code, url);

const retainedInputErrorCopy = (
  code: ImportRecipeErrorCode,
  inputName: "photos" | "text",
): UrlImportErrorCopy => {
  const retainedInput =
    inputName === "photos"
      ? "Your selected photos are still here."
      : "Your text is still here.";
  if (code === "NO_RECIPE_FOUND") {
    return {
      title: "Couldn't find a recipe",
      body: `${inputName === "photos" ? "These photos don't" : "This text doesn't"} seem to contain a readable recipe. ${retainedInput}`,
    };
  }
  return {
    title:
      code === "EXTRACTION_FAILED"
        ? "Couldn't finish the recipe"
        : `Couldn't read the ${inputName}`,
    body:
      code === "EXTRACTION_FAILED"
        ? `Something went wrong while structuring it. ${retainedInput}`
        : `We couldn't read enough of this source to make a recipe. ${retainedInput}`,
  };
};

const urlSourceCopy = {
  phases: urlImportPhases,
  error: urlImportErrorCopy,
};

const importSourceCopy: Record<
  RecipeImportSource,
  {
    phases: (url: string) => string[];
    error: (code: ImportRecipeErrorCode, url: string) => UrlImportErrorCopy;
  }
> = {
  link: urlSourceCopy,
  youtube: urlSourceCopy,
  instagram: urlSourceCopy,
  photos: {
    phases: () => [
      "Reading the photos",
      "Reading the recipe",
      "Structuring it",
    ],
    error: (code) => retainedInputErrorCopy(code, "photos"),
  },
  text: {
    phases: () => ["Reading the recipe", "Structuring it"],
    error: (code) => retainedInputErrorCopy(code, "text"),
  },
};

export const importPhases = (source: RecipeImportSource, url = ""): string[] =>
  importSourceCopy[source].phases(url);
