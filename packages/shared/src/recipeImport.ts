export const importRecipeErrorCodes = [
  "FETCH_FAILED",
  "IMPORT_LIMIT_REACHED",
  "SITE_BLOCKED",
  "PAGE_UNREADABLE",
  "TRANSCRIPT_UNAVAILABLE",
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
  TRANSCRIPT_UNAVAILABLE:
    "We couldn't import this video because no transcript was available and its caption didn't contain a readable recipe. Paste the recipe text below.",
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
const INSTAGRAM_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9!$*_-]+$/;
const INSTAGRAM_USERNAME_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const INSTAGRAM_MEDIA_KINDS = ["reel", "reels", "p", "tv"] as const;
const INSTAGRAM_RESERVED_PATH_SEGMENTS = new Set([
  "accounts",
  "about",
  "developer",
  "direct",
  "explore",
  "legal",
  "p",
  "reel",
  "reels",
  "share",
  "stories",
  "tv",
]);

type InstagramMediaKind = (typeof INSTAGRAM_MEDIA_KINDS)[number];

const parsedHttpUrl = (value: string | URL) => {
  try {
    const url = typeof value === "string" ? new URL(value) : value;
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

const isInstagramMediaKind = (value: string): value is InstagramMediaKind =>
  INSTAGRAM_MEDIA_KINDS.some((kind) => kind === value);

const hasInstagramEmbedSuffix = (segments: string[]) =>
  segments.length === 0 ||
  (segments.length === 1 && segments[0] === "embed") ||
  (segments.length === 2 &&
    segments[0] === "embed" &&
    segments[1] === "captioned");

const instagramDirectMediaFromUrl = (value: string | URL) => {
  const url = parsedHttpUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const pathSegments = url.pathname.split("/").filter(Boolean);

  if (hostname === "instagr.am") {
    const [kind, mediaId, ...suffix] = pathSegments;
    return kind === "p" &&
      mediaId &&
      INSTAGRAM_MEDIA_ID_PATTERN.test(mediaId) &&
      hasInstagramEmbedSuffix(suffix)
      ? { kind, mediaId }
      : null;
  }

  if (hostname !== "instagram.com" && hostname !== "m.instagram.com") {
    return null;
  }

  const [first, second, third, ...remaining] = pathSegments;
  const ownerQualified =
    first !== undefined &&
    !INSTAGRAM_RESERVED_PATH_SEGMENTS.has(first) &&
    INSTAGRAM_USERNAME_PATTERN.test(first);
  const kind = isInstagramMediaKind(first ?? "")
    ? first
    : ownerQualified && isInstagramMediaKind(second ?? "")
      ? second
      : null;
  const mediaId = kind === first ? second : third;
  const suffix = kind === first ? pathSegments.slice(2) : remaining;

  if (
    !kind ||
    !mediaId ||
    !INSTAGRAM_MEDIA_ID_PATTERN.test(mediaId) ||
    !hasInstagramEmbedSuffix(suffix)
  ) {
    return null;
  }

  return { kind, mediaId };
};

const instagramShareFromUrl = (value: string | URL) => {
  const url = parsedHttpUrl(value);
  if (!url) return null;

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname !== "instagram.com" && hostname !== "m.instagram.com") {
    return null;
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  const [share, second, third] = pathSegments;
  const typedShare = second === "reel" || second === "p";
  const token = typedShare ? third : second;
  if (
    share !== "share" ||
    pathSegments.length !== (typedShare ? 3 : 2) ||
    !token ||
    !INSTAGRAM_SHARE_TOKEN_PATTERN.test(token)
  ) {
    return null;
  }

  return { kind: typedShare ? second : null, token };
};

export const instagramMediaIdFromUrl = (value: string | URL) => {
  return instagramDirectMediaFromUrl(value)?.mediaId ?? null;
};

export const isInstagramShareUrl = (value: string | URL) =>
  instagramShareFromUrl(value) !== null;

export const isInstagramMediaUrl = (value: string | URL) =>
  instagramDirectMediaFromUrl(value) !== null || isInstagramShareUrl(value);

export const canonicalInstagramMediaUrl = (value: string | URL) => {
  const media = instagramDirectMediaFromUrl(value);
  if (!media) return null;

  const canonicalKind = media.kind === "reels" ? "reel" : media.kind;
  return `https://www.instagram.com/${canonicalKind}/${media.mediaId}/`;
};

export const canonicalInstagramShareUrl = (value: string | URL) => {
  const share = instagramShareFromUrl(value);
  if (!share) return null;

  const shareKind = share.kind ? `${share.kind}/` : "";
  return `https://www.instagram.com/share/${shareKind}${share.token}/`;
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
