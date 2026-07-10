export const importRecipeErrorCodes = [
  "FETCH_FAILED",
  "SITE_BLOCKED",
  "PAGE_UNREADABLE",
  "NO_RECIPE_FOUND",
  "EXTRACTION_FAILED",
] as const;

export type ImportRecipeErrorCode = (typeof importRecipeErrorCodes)[number];

// Image uploads are base64 encoded, so this leaves room below Vercel's 4.5 MB
// request limit for the surrounding tRPC payload.
export const MAX_RECIPE_IMPORT_IMAGES = 4;
export const MAX_RECIPE_IMPORT_IMAGE_DATA_LENGTH = 4_000_000;

// Thrown by the server import pipeline; the tRPC errorFormatter lifts the
// code into error.data.importErrorCode so clients get it typed.
export class ImportRecipeError extends Error {
  constructor(
    public readonly code: ImportRecipeErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ImportRecipeError";
  }
}

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

export const YOUTUBE_NO_RECIPE_FOUND_MESSAGE =
  "This video has no captions or written recipe — paste the recipe text instead?";

const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export const youtubeVideoIdFromUrl = (value: string | URL) => {
  let url: URL;
  try {
    url = typeof value === "string" ? new URL(value) : value;
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  let candidate: string | null = null;

  if (hostname === "youtu.be") {
    candidate = url.pathname.split("/").find(Boolean) ?? null;
  } else if (hostname === "youtube.com" || hostname === "m.youtube.com") {
    if (url.pathname === "/watch") {
      candidate = url.searchParams.get("v");
    } else {
      const [kind, id] = url.pathname.split("/").filter(Boolean);
      candidate = kind === "shorts" ? (id ?? null) : null;
    }
  }

  return candidate && YOUTUBE_VIDEO_ID_PATTERN.test(candidate)
    ? candidate
    : null;
};

export const isYouTubeVideoUrl = (value: string | URL) =>
  youtubeVideoIdFromUrl(value) !== null;

export const validUrlOrNull = (value: string) => {
  try {
    return new URL(value.trim()).toString();
  } catch {
    return null;
  }
};

export const sourceLabel = (link: string) => {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return link;
  }
};
