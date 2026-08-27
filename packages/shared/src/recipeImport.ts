export const importRecipeErrorCodes = [
  "FETCH_FAILED",
  "IMPORT_LIMIT_REACHED",
  "SITE_BLOCKED",
  "PAGE_UNREADABLE",
  "NO_RECIPE_FOUND",
  "EXTRACTION_FAILED",
] as const;

export type ImportRecipeErrorCode = (typeof importRecipeErrorCodes)[number];

export const isImportRecipeErrorCode = (
  value: unknown,
): value is ImportRecipeErrorCode =>
  typeof value === "string" &&
  importRecipeErrorCodes.some((code) => code === value);

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
  IMPORT_LIMIT_REACHED:
    "We've hit the recipe import limit. Please let Aslak know that we need to upgrade the Supadata plan.",
  SITE_BLOCKED:
    "This site blocks automated requests, so we couldn't read it. Paste the recipe text below and we'll structure it for you.",
  PAGE_UNREADABLE:
    "We couldn't read this page automatically — some sites build their recipe with JavaScript, so there's nothing on the page for us to grab. Paste the recipe text below and we'll structure it for you.",
  NO_RECIPE_FOUND:
    "We couldn't find a recipe in that source. If there is one, paste the text below.",
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

const INSTAGRAM_MEDIA_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const instagramMediaIdFromUrl = (value: string | URL) => {
  let url: URL;
  try {
    url = typeof value === "string" ? new URL(value) : value;
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "instagram.com") return null;

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const [kind, mediaId] = pathSegments;
  if (
    pathSegments.length !== 2 ||
    (kind !== "reel" && kind !== "reels" && kind !== "p" && kind !== "tv") ||
    !mediaId ||
    !INSTAGRAM_MEDIA_ID_PATTERN.test(mediaId)
  ) {
    return null;
  }

  return mediaId;
};

export const isInstagramMediaUrl = (value: string | URL) =>
  instagramMediaIdFromUrl(value) !== null;

export const canonicalInstagramMediaUrl = (value: string | URL) => {
  const mediaId = instagramMediaIdFromUrl(value);
  if (!mediaId) return null;

  const url = typeof value === "string" ? new URL(value) : value;
  const [kind] = url.pathname.split("/").filter(Boolean);
  const canonicalKind = kind === "reels" ? "reel" : kind;
  return `https://www.instagram.com/${canonicalKind}/${mediaId}/`;
};

export const validUrlOrNull = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
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
