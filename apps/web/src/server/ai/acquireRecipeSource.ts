import { isIP } from "node:net";
import { load } from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import {
  fetchTranscript,
  listLanguages,
  type TranscriptSegment,
} from "youtube-transcript-plus";

import { env } from "~/env";
import { RecipeImportError } from "./recipeImportError";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeat/1.0";
const MAX_PAGE_BYTES = 3_000_000;
const MIN_READABLE_CHARACTERS = 200;
const MAX_REDIRECTS = 4;

type YouTubeVideoResponse = {
  items?: Array<{
    snippet?: { title?: string; description?: string };
  }>;
};

export async function acquireRecipeSource(sourceUrl: string) {
  const url = new URL(sourceUrl);
  assertPublicHttpUrl(url);

  const videoId = youtubeVideoId(url);
  if (videoId) {
    return acquireYouTubeSource(videoId);
  }

  const html = await fetchHtml(url);
  const jsonLdRecipe = findJsonLdRecipe(html);
  if (jsonLdRecipe) {
    return JSON.stringify(jsonLdRecipe);
  }

  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const text = article?.textContent?.replace(/\s+/g, " ").trim() ?? "";

  if (text.length < MIN_READABLE_CHARACTERS) {
    throw new RecipeImportError(
      "NO_RECIPE_FOUND",
      "We could not find readable recipe content on that page.",
    );
  }

  return text;
}

async function fetchHtml(initialUrl: URL) {
  let url = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
    } catch (cause) {
      throw new RecipeImportError(
        "FETCH_FAILED",
        "We could not load that page. Check the link and try again.",
        { cause },
      );
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new RecipeImportError(
          "FETCH_FAILED",
          "That page redirected too many times.",
        );
      }
      url = new URL(location, url);
      assertPublicHttpUrl(url);
      continue;
    }

    if (!response.ok) {
      throw new RecipeImportError(
        "FETCH_FAILED",
        `That page returned ${response.status}. Try pasting the recipe text instead.`,
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_PAGE_BYTES) {
      throw new RecipeImportError(
        "FETCH_FAILED",
        "That page is too large to import.",
      );
    }

    const html = await response.text();
    if (Buffer.byteLength(html) > MAX_PAGE_BYTES) {
      throw new RecipeImportError(
        "FETCH_FAILED",
        "That page is too large to import.",
      );
    }
    return html;
  }

  throw new RecipeImportError("FETCH_FAILED", "We could not load that page.");
}

function findJsonLdRecipe(html: string): Record<string, unknown> | null {
  const $ = load(html);

  for (const element of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(element).text().trim();
    if (!raw) continue;

    try {
      const match = findRecipeNode(JSON.parse(raw) as unknown);
      if (match) return match;
    } catch {
      // Invalid JSON-LD is common; another block or Readability may still work.
    }
  }

  return null;
}

function findRecipeNode(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findRecipeNode(item);
      if (match) return match;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const types = Array.isArray(record["@type"])
    ? record["@type"]
    : [record["@type"]];
  if (types.some((type) => type === "Recipe")) return record;

  const graphMatch = findRecipeNode(record["@graph"]);
  if (graphMatch) return graphMatch;

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const match = findRecipeNode(nested);
      if (match) return match;
    }
  }

  return null;
}

async function acquireYouTubeSource(videoId: string) {
  if (!env.YOUTUBE_API_KEY) {
    throw new RecipeImportError(
      "FETCH_FAILED",
      "YouTube import is not configured yet.",
    );
  }

  let response: Response;
  try {
    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    apiUrl.searchParams.set("part", "snippet");
    apiUrl.searchParams.set("id", videoId);
    apiUrl.searchParams.set("key", env.YOUTUBE_API_KEY);
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(10_000) });
  } catch (cause) {
    throw new RecipeImportError(
      "FETCH_FAILED",
      "We could not load that YouTube video.",
      { cause },
    );
  }

  if (!response.ok) {
    throw new RecipeImportError(
      "FETCH_FAILED",
      "That YouTube video is unavailable or private.",
    );
  }

  const data = (await response.json()) as YouTubeVideoResponse;
  const snippet = data.items?.[0]?.snippet;
  if (!snippet) {
    throw new RecipeImportError(
      "FETCH_FAILED",
      "That YouTube video is unavailable or private.",
    );
  }

  let transcript: TranscriptSegment[] = [];
  try {
    const languages = await listLanguages(videoId, {
      userAgent: USER_AGENT,
      signal: AbortSignal.timeout(15_000),
    });
    const preferred =
      languages.find((language) => !language.isAutoGenerated) ?? languages[0];
    if (preferred) {
      transcript = await fetchTranscript(videoId, {
        lang: preferred.languageCode,
        userAgent: USER_AGENT,
        signal: AbortSignal.timeout(20_000),
      });
    }
  } catch {
    // A useful written description is enough; captions are best effort.
  }

  const description = snippet.description?.trim() ?? "";
  const transcriptText = transcript.map((segment) => segment.text).join(" ");
  if (description.length < 80 && transcriptText.length < 200) {
    throw new RecipeImportError(
      "NO_RECIPE_FOUND",
      "This video has no captions or written recipe. Paste the recipe text instead.",
    );
  }

  return `YouTube title:\n${snippet.title ?? ""}\n\nYouTube description (prefer exact ingredients here):\n${description}\n\nCaption transcript:\n${transcriptText}`;
}

function youtubeVideoId(url: URL) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be") {
    return url.pathname.split("/").find(Boolean) ?? null;
  }
  if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");

  const [kind, id] = url.pathname.split("/").filter(Boolean);
  return kind === "shorts" || kind === "embed" ? (id ?? null) : null;
}

function assertPublicHttpUrl(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new RecipeImportError(
      "FETCH_FAILED",
      "Only http and https links can be imported.",
    );
  }

  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    isPrivateIp(hostname)
  ) {
    throw new RecipeImportError("FETCH_FAILED", "That link cannot be fetched.");
  }
}

function isPrivateIp(hostname: string) {
  if (isIP(hostname) === 4) {
    const [a = 0, b = 0] = hostname.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }

  if (isIP(hostname) === 6) {
    return (
      hostname === "::1" ||
      hostname.startsWith("fc") ||
      hostname.startsWith("fd") ||
      hostname.startsWith("fe8") ||
      hostname.startsWith("fe9") ||
      hostname.startsWith("fea") ||
      hostname.startsWith("feb")
    );
  }

  return false;
}
