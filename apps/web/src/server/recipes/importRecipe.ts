import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  ImportRecipeError,
  youtubeVideoIdFromUrl,
} from "@planeatrepeat/shared";

import {
  extractRecipe,
  type ExtractInput,
  type ExtractResult,
} from "~/server/ai/extractRecipe";
import { acquireYouTubeRecipeText } from "~/server/recipes/youtube";

const FETCH_TIMEOUT_MS = 12_000;
const WAYBACK_TIMEOUT_MS = 12_000;
const MIN_READABLE_TEXT_LENGTH = 400;
const MAX_TEXT_LENGTH = 40_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeatRecipeImport/1.0";

type JsonLdObject = Record<string, unknown>;
type ParsedDocument = ReturnType<typeof parseHTML>["document"];

export const importRecipeFromUrl = async (
  url: string,
  instructions?: string | null,
): Promise<ExtractResult> => {
  const videoId = youtubeVideoIdFromUrl(url);
  const source = videoId
    ? await acquireYouTubeRecipeText(videoId)
    : await acquireRecipeTextFromUrl(url);
  return extractOrThrow(
    [{ type: "text", text: trimForModel(source) }],
    instructions,
  );
};

export const importRecipeFromText = async (
  text: string,
  instructions?: string | null,
): Promise<ExtractResult> =>
  extractOrThrow([{ type: "text", text: trimForModel(text) }], instructions);

export const importRecipeFromImages = async (
  images: Array<{ data: string; mimeType: string }>,
  instructions?: string | null,
): Promise<ExtractResult> =>
  extractOrThrow(
    images.map((image) => ({
      type: "image" as const,
      image: Buffer.from(image.data, "base64"),
      mimeType: image.mimeType,
    })),
    instructions,
  );

const extractOrThrow = async (
  parts: ExtractInput["parts"],
  instructions?: string | null,
): Promise<ExtractResult> => {
  try {
    return await extractRecipe({ parts, instructions });
  } catch (error) {
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("EXTRACTION_FAILED", errorMessage(error));
  }
};

const acquireRecipeTextFromUrl = async (url: string): Promise<string> => {
  try {
    const html = await fetchHtml(url);
    return recipeTextFromHtml(html, url);
  } catch (error) {
    // Bot-protected sites (Cloudflare et al.) refuse our fetch. Try the
    // Wayback Machine's cached copy before giving up. If that misses, we
    // re-throw the original SITE_BLOCKED — the user just sees the same error,
    // with no mention that we attempted an archive lookup.
    if (error instanceof ImportRecipeError && error.code === "SITE_BLOCKED") {
      const archived = await recipeTextFromWayback(url);
      if (archived) return archived;
    }
    throw error;
  }
};

const recipeTextFromHtml = (html: string, url: string): string => {
  const { document } = parseHTML(html);

  const jsonLdRecipe = findJsonLdRecipe(document);
  if (jsonLdRecipe) {
    return JSON.stringify(jsonLdRecipe);
  }

  // Readability mutates the document, so it must run after the JSON-LD pass.
  const readableText = extractReadableText(document, url);
  if (!looksLikeRecipe(readableText)) {
    throw new ImportRecipeError("NO_RECIPE_FOUND");
  }

  return readableText;
};

// Best-effort archive lookup: returns recipe text if the Wayback Machine has
// a usable snapshot, otherwise null. Never throws — any miss falls back to the
// original live-fetch error.
const recipeTextFromWayback = async (url: string): Promise<string | null> => {
  const html = await fetchArchivedHtml(url);
  if (!html) return null;

  try {
    return recipeTextFromHtml(html, url);
  } catch {
    return null;
  }
};

const fetchArchivedHtml = async (url: string): Promise<string | null> => {
  try {
    // "2" is a partial timestamp Wayback resolves to the closest snapshot
    // (302 redirect, 404 when none exists); the `id_` modifier returns the
    // original archived HTML without the archive.org toolbar/URL rewrites,
    // so our normal extraction works on it.
    const res = await timedFetch(
      `https://web.archive.org/web/2id_/${url}`,
      WAYBACK_TIMEOUT_MS,
      { "User-Agent": USER_AGENT },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
};

const fetchHtml = async (url: string) => {
  try {
    const response = await timedFetch(url, FETCH_TIMEOUT_MS, {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,nb;q=0.8,nn;q=0.7",
      "User-Agent": USER_AGENT,
    });

    if (!response.ok) {
      throw new ImportRecipeError(
        isBlockedStatus(response.status) ? "SITE_BLOCKED" : "FETCH_FAILED",
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new ImportRecipeError("PAGE_UNREADABLE");
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("FETCH_FAILED", errorMessage(error));
  }
};

const timedFetch = async (
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const findJsonLdRecipe = (document: ParsedDocument): JsonLdObject | null => {
  const scripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  ) as ArrayLike<{ textContent: string | null }>;

  for (const script of Array.from(scripts)) {
    const raw = script.textContent?.trim();
    if (!raw) continue;

    try {
      const parsed: unknown = JSON.parse(raw);
      const recipe = findRecipeNode(parsed);
      if (recipe) return recipe;
    } catch {
      continue;
    }
  }

  return null;
};

const findRecipeNode = (value: unknown): JsonLdObject | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const recipe = findRecipeNode(item);
      if (recipe) return recipe;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  if (isRecipeType(value["@type"])) {
    return value;
  }

  for (const nested of Object.values(value)) {
    const recipe = findRecipeNode(nested);
    if (recipe) return recipe;
  }

  return null;
};

const isRecipeType = (type: unknown) => {
  if (typeof type === "string") return type.toLowerCase() === "recipe";
  if (Array.isArray(type)) return type.some(isRecipeType);
  return false;
};

const extractReadableText = (document: ParsedDocument, url: string) => {
  const reader = new Readability(document, { keepClasses: false });
  const article = reader.parse();
  const text = [article?.title, article?.textContent]
    .filter(Boolean)
    .join("\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (text.length < MIN_READABLE_TEXT_LENGTH) {
    throw new ImportRecipeError("PAGE_UNREADABLE");
  }

  return `Source URL: ${url}\n\n${text}`;
};

const looksLikeRecipe = (text: string) => {
  // Collapse all whitespace to single spaces and pad the ends so the
  // space-delimited unit tokens also match at line breaks and boundaries.
  const normalized = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;
  const ingredientSignals = [
    "ingredient",
    "ingredients",
    "ingrediens",
    "ingredienser",
    "du trenger",
    "dette trenger du",
  ];
  const instructionSignals = [
    "instruction",
    "instructions",
    "method",
    "directions",
    "step",
    "steps",
    "fremgangsmåte",
    "slik gjør du",
    "gjør slik",
    "tilberedning",
  ];
  const unitSignals = [
    " g ",
    " kg ",
    " dl ",
    " ml ",
    " ss ",
    " ts ",
    "tbsp",
    "tsp",
    "spiseskje",
    "teskje",
  ];

  return (
    ingredientSignals.some((signal) => normalized.includes(signal)) ||
    (instructionSignals.some((signal) => normalized.includes(signal)) &&
      unitSignals.some((signal) => normalized.includes(signal)))
  );
};

const trimForModel = (text: string) => text.slice(0, MAX_TEXT_LENGTH);

// Status codes that mean the site refused us (bot protection / rate limiting /
// Cloudflare "under attack") rather than a broken link — the URL is fine, so
// the UI should point at the paste fallback, not "double-check the URL".
// 402 is included because some sites (e.g. seriouseats) use it for bot walls.
const isBlockedStatus = (status: number) =>
  status === 401 ||
  status === 402 ||
  status === 403 ||
  status === 429 ||
  status === 503;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Recipe import failed";
