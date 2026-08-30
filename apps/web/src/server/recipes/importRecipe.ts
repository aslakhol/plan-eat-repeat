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
import type { LanguageModelUsage } from "ai";
import {
  acquireInstagramRecipeText,
  resolveInstagramMediaSource,
} from "~/server/recipes/instagram";
import { scrapeRecipeTextWithSupadata } from "~/server/recipes/supadataWeb";
import { acquireYouTubeRecipeText } from "~/server/recipes/youtube";

const FETCH_TIMEOUT_MS = 12_000;
const MIN_READABLE_TEXT_LENGTH = 400;
const MAX_TEXT_LENGTH = 40_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeatRecipeImport/1.0";

type JsonLdObject = Record<string, unknown>;
type ParsedDocument = ReturnType<typeof parseHTML>["document"];

export const importRecipeFromUrl = async (
  url: string,
  instructions?: string | null,
  signal?: AbortSignal,
  observer?: InferenceObserver,
): Promise<ExtractResult> => {
  const videoId = youtubeVideoIdFromUrl(url);
  const instagramSource = videoId
    ? null
    : await resolveInstagramMediaSource(url, signal);
  const source = videoId
    ? await acquireYouTubeRecipeText(videoId, signal)
    : instagramSource
      ? await acquireInstagramRecipeText(
          instagramSource.mediaUrl,
          instagramSource.mediaId,
          signal,
        )
      : await acquireRecipeTextFromUrl(url, signal);
  return extractOrThrow(
    [{ type: "text", text: trimForModel(source) }],
    instructions,
    signal,
    observer,
  );
};

export const importRecipeFromText = async (
  text: string,
  instructions?: string | null,
  signal?: AbortSignal,
  observer?: InferenceObserver,
): Promise<ExtractResult> =>
  extractOrThrow(
    [{ type: "text", text: trimForModel(text) }],
    instructions,
    signal,
    observer,
  );

export type InferenceObserver = {
  onInferenceStart(): Promise<void> | void;
  onInferenceUsage(
    model: string,
    usage: LanguageModelUsage,
  ): Promise<void> | void;
};

export type RecipeImportImage = { data: string; mimeType: string };

export const importRecipeFromImages = async (
  images: ReadonlyArray<RecipeImportImage>,
  instructions?: string | null,
  signal?: AbortSignal,
  observer?: InferenceObserver,
): Promise<ExtractResult> =>
  extractOrThrow(
    images.map((image) => ({
      type: "image" as const,
      image: Buffer.from(image.data, "base64"),
      mimeType: image.mimeType,
    })),
    instructions,
    signal,
    observer,
  );

const extractOrThrow = async (
  parts: ExtractInput["parts"],
  instructions?: string | null,
  signal?: AbortSignal,
  observer?: InferenceObserver,
): Promise<ExtractResult> => {
  try {
    return await extractRecipe({
      parts,
      instructions,
      abortSignal: signal,
      observer,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("EXTRACTION_FAILED", errorMessage(error));
  }
};

const acquireRecipeTextFromUrl = async (
  url: string,
  signal?: AbortSignal,
): Promise<string> => {
  try {
    const html = await fetchHtml(url, signal);
    return recipeTextFromHtml(html, url);
  } catch (error) {
    if (isSupadataFallbackEligible(error)) {
      try {
        return await scrapeRecipeTextWithSupadata(url, signal);
      } catch (fallbackError) {
        if (signal?.aborted) throw fallbackError;
        if (
          fallbackError instanceof ImportRecipeError &&
          fallbackError.code === "IMPORT_LIMIT_REACHED"
        ) {
          throw fallbackError;
        }
      }
    }
    throw error;
  }
};

const isSupadataFallbackEligible = (error: unknown) =>
  error instanceof ImportRecipeError &&
  (error.code === "SITE_BLOCKED" ||
    error.code === "FETCH_FAILED" ||
    error.code === "PAGE_UNREADABLE");

const recipeTextFromHtml = (html: string, url: string): string => {
  const { document } = parseHTML(html);

  const jsonLdRecipe = findJsonLdRecipe(document);
  let readableText: string | null = null;

  try {
    // Readability mutates the document, so it must run after the JSON-LD pass.
    const extractedText = extractReadableText(document, url);
    if (jsonLdRecipe || looksLikeRecipe(extractedText)) {
      readableText = extractedText;
    }
  } catch (error) {
    if (!jsonLdRecipe) throw error;
  }

  if (jsonLdRecipe && readableText) {
    return combineRecipeEvidence(jsonLdRecipe, readableText);
  }

  if (jsonLdRecipe) return JSON.stringify(jsonLdRecipe);
  if (readableText) return readableText;

  throw new ImportRecipeError("NO_RECIPE_FOUND");
};

const combineRecipeEvidence = (
  jsonLdRecipe: JsonLdObject,
  readableText: string,
) => {
  const structuredPrefix = "<structured-recipe-data>\n";
  const structuredSuffix = "\n</structured-recipe-data>";
  const readablePrefix = "\n\n<visible-page-content>\n";
  const readableSuffix = "\n</visible-page-content>";
  const wrapperLength =
    structuredPrefix.length +
    structuredSuffix.length +
    readablePrefix.length +
    readableSuffix.length;
  const evidenceBudget = MAX_TEXT_LENGTH - wrapperLength;
  const structuredBudget = Math.floor(evidenceBudget / 2);
  const readableBudget = evidenceBudget - structuredBudget;

  return `${structuredPrefix}${trimEvidence(
    JSON.stringify(jsonLdRecipe),
    structuredBudget,
  )}${structuredSuffix}${readablePrefix}${trimEvidence(
    readableText,
    readableBudget,
  )}${readableSuffix}`;
};

const trimEvidence = (text: string, maxLength: number) => {
  const marker = "\n[truncated]";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - marker.length)}${marker}`;
};

const fetchHtml = async (url: string, signal?: AbortSignal) => {
  try {
    const response = await timedFetch(
      url,
      FETCH_TIMEOUT_MS,
      {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,nb;q=0.8,nn;q=0.7",
        "User-Agent": USER_AGENT,
      },
      signal,
    );

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
    if (signal?.aborted) throw error;
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("FETCH_FAILED", errorMessage(error));
  }
};

const timedFetch = async (
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
  signal?: AbortSignal,
) => {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return fetch(url, {
    headers,
    signal: signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal,
  });
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
