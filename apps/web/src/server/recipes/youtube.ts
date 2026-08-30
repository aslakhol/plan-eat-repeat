import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  createSupadataYouTubeAdapter,
  type SupadataYouTubeEvidence,
} from "./supadata";
import type { SupadataSpendObserver } from "./supadata-spend";

const ACQUISITION_TIMEOUT_MS = 20_000;
const MAX_YOUTUBE_EVIDENCE_LENGTH = 40_000;
const MAX_TITLE_LENGTH = 500;
const MAX_DESCRIPTION_LENGTH = 8_000;
const TRUNCATION_MARKER = "\n[truncated]";

type YouTubeSourceAdapter = {
  acquire: (
    videoId: string,
    signal: AbortSignal,
  ) => Promise<SupadataYouTubeEvidence>;
};

type YouTubeOEmbedResponse = {
  title?: string;
};

export const acquireYouTubeVideoTitle = async (
  videoId: string,
  requestSignal?: AbortSignal,
) => {
  const timeoutSignal = AbortSignal.timeout(5_000);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal;
  const url = new URL("https://www.youtube.com/oembed");
  url.searchParams.set(
    "url",
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
  );
  url.searchParams.set("format", "json");

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;
    const body = (await response.json()) as YouTubeOEmbedResponse;
    return body.title?.trim() ?? null;
  } catch {
    return null;
  }
};

export const createYouTubeRecipeTextAcquirer = (
  adapter: YouTubeSourceAdapter,
  acquisitionTimeoutMs = ACQUISITION_TIMEOUT_MS,
) =>
  async (videoId: string, requestSignal?: AbortSignal): Promise<string> => {
    const timeoutSignal = AbortSignal.timeout(acquisitionTimeoutMs);
    const signal = requestSignal
      ? AbortSignal.any([requestSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const evidence = await adapter.acquire(videoId, signal);
      if (!evidence.description.trim() && !evidence.transcript.trim()) {
        throw new ImportRecipeError("NO_RECIPE_FOUND");
      }
      return formatYouTubeEvidence(evidence);
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      if (error instanceof ImportRecipeError) throw error;
      throw new ImportRecipeError(
        "FETCH_FAILED",
        error instanceof Error ? error.message : "YouTube acquisition failed",
      );
    }
  };

export const acquireYouTubeRecipeText = async (
  videoId: string,
  requestSignal?: AbortSignal,
  spendObserver?: SupadataSpendObserver,
) => {
  const { env } = await import("~/env");
  const adapter = createSupadataYouTubeAdapter({
    apiKey: env.SUPADATA_API_KEY,
    fetch,
    spendObserver,
  });
  return createYouTubeRecipeTextAcquirer(adapter)(videoId, requestSignal);
};

const formatYouTubeEvidence = (evidence: SupadataYouTubeEvidence) => {
  const title = truncateSection(evidence.title.trim(), MAX_TITLE_LENGTH);
  const description = truncateSection(
    evidence.description.trim(),
    MAX_DESCRIPTION_LENGTH,
  );
  const prefix = `YouTube title:\n${title}\n\nYouTube description:\n${description}\n\nCaption transcript:\n`;
  const transcript = truncateSection(
    evidence.transcript.trim(),
    MAX_YOUTUBE_EVIDENCE_LENGTH - prefix.length,
  );
  return `${prefix}${transcript}`;
};

const truncateSection = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
};
