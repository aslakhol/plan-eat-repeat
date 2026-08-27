import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  createSupadataInstagramAdapter,
  type SupadataInstagramEvidence,
} from "./supadata";

const ACQUISITION_TIMEOUT_MS = 30_000;
const MAX_INSTAGRAM_EVIDENCE_LENGTH = 40_000;
const MAX_TITLE_LENGTH = 500;
const MAX_CAPTION_LENGTH = 8_000;
const TRUNCATION_MARKER = "\n[truncated]";

type InstagramSourceAdapter = {
  acquire: (
    mediaUrl: string,
    mediaId: string,
    signal: AbortSignal,
  ) => Promise<SupadataInstagramEvidence>;
};

export const createInstagramRecipeTextAcquirer =
  (
    adapter: InstagramSourceAdapter,
    acquisitionTimeoutMs = ACQUISITION_TIMEOUT_MS,
  ) =>
  async (
    mediaUrl: string,
    mediaId: string,
    requestSignal?: AbortSignal,
  ): Promise<string> => {
    const timeoutSignal = AbortSignal.timeout(acquisitionTimeoutMs);
    const signal = requestSignal
      ? AbortSignal.any([requestSignal, timeoutSignal])
      : timeoutSignal;

    try {
      const evidence = await adapter.acquire(mediaUrl, mediaId, signal);
      if (!evidence.description.trim() && !evidence.transcript.trim()) {
        throw new ImportRecipeError("NO_RECIPE_FOUND");
      }
      return formatInstagramEvidence(evidence);
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      if (error instanceof ImportRecipeError) throw error;
      throw new ImportRecipeError(
        "FETCH_FAILED",
        error instanceof Error ? error.message : "Instagram acquisition failed",
      );
    }
  };

export const acquireInstagramRecipeText = async (
  mediaUrl: string,
  mediaId: string,
  requestSignal?: AbortSignal,
) => {
  const { env } = await import("~/env");
  const adapter = createSupadataInstagramAdapter({
    apiKey: env.SUPADATA_API_KEY,
    fetch,
  });
  return createInstagramRecipeTextAcquirer(adapter)(
    mediaUrl,
    mediaId,
    requestSignal,
  );
};

const formatInstagramEvidence = (evidence: SupadataInstagramEvidence) => {
  const title = truncateSection(evidence.title.trim(), MAX_TITLE_LENGTH);
  const caption = truncateSection(
    evidence.description.trim(),
    MAX_CAPTION_LENGTH,
  );
  const prefix = `Instagram title:\n${title}\n\nInstagram caption:\n${caption}\n\nTranscript:\n`;
  const transcript = truncateSection(
    evidence.transcript.trim(),
    MAX_INSTAGRAM_EVIDENCE_LENGTH - prefix.length,
  );
  return `${prefix}${transcript}`;
};

const truncateSection = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - TRUNCATION_MARKER.length)}${TRUNCATION_MARKER}`;
};
