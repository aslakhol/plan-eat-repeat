import { Readability } from "@mozilla/readability";
import * as cheerio from "cheerio";
import { parseHTML } from "linkedom";

import { extractRecipe, type ExtractResult } from "~/server/ai/extractRecipe";

export const importRecipeErrorCodes = [
  "FETCH_FAILED",
  "PAGE_UNREADABLE",
  "NO_RECIPE_FOUND",
  "EXTRACTION_FAILED",
] as const;

export type ImportRecipeErrorCode = (typeof importRecipeErrorCodes)[number];

export class ImportRecipeError extends Error {
  constructor(
    public readonly code: ImportRecipeErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "ImportRecipeError";
  }
}

const FETCH_TIMEOUT_MS = 12_000;
const MIN_READABLE_TEXT_LENGTH = 400;
const MAX_TEXT_PART_LENGTH = 40_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeatRecipeImport/1.0";

type RecipeTextPart = { type: "text"; text: string };
type JsonLdObject = Record<string, unknown>;

export const importRecipeFromUrl = async (input: {
  url: string;
  instructions?: string;
}): Promise<ExtractResult> => {
  const source = await acquireRecipeTextFromUrl(input.url);

  try {
    return await extractRecipe({
      parts: [source],
      instructions: input.instructions,
    });
  } catch (error) {
    throw new ImportRecipeError("EXTRACTION_FAILED", errorMessage(error));
  }
};

export const importRecipeFromText = async (input: {
  text: string;
  instructions?: string;
}): Promise<ExtractResult> => {
  try {
    return await extractRecipe({
      parts: [{ type: "text", text: trimForModel(input.text) }],
      instructions: input.instructions,
    });
  } catch (error) {
    throw new ImportRecipeError("EXTRACTION_FAILED", errorMessage(error));
  }
};

export const acquireRecipeTextFromUrl = async (
  url: string,
): Promise<RecipeTextPart> => {
  const html = await fetchHtml(url);
  const jsonLdRecipe = findJsonLdRecipe(html);

  if (jsonLdRecipe) {
    return {
      type: "text",
      text: JSON.stringify(jsonLdRecipe),
    };
  }

  const readableText = extractReadableText(html, url);
  if (!looksLikeRecipe(readableText)) {
    throw new ImportRecipeError("NO_RECIPE_FOUND");
  }

  return {
    type: "text",
    text: trimForModel(readableText),
  };
};

const fetchHtml = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,nb;q=0.8,nn;q=0.7",
        "User-Agent": USER_AGENT,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new ImportRecipeError("FETCH_FAILED");
    }

    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new ImportRecipeError("PAGE_UNREADABLE");
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("FETCH_FAILED", errorMessage(error));
  } finally {
    clearTimeout(timeout);
  }
};

const findJsonLdRecipe = (html: string): JsonLdObject | null => {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');

  for (const script of scripts.toArray()) {
    const raw = $(script).text().trim();
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

  const graph = value["@graph"];
  if (graph) {
    const recipe = findRecipeNode(graph);
    if (recipe) return recipe;
  }

  for (const nested of Object.values(value)) {
    if (typeof nested !== "object" || nested === null) continue;
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

const extractReadableText = (html: string, url: string) => {
  const { document } = parseHTML(html);
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
  const normalized = text.toLowerCase();
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

const trimForModel = (text: string) =>
  text.length > MAX_TEXT_PART_LENGTH
    ? text.slice(0, MAX_TEXT_PART_LENGTH)
    : text;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Recipe import failed";
