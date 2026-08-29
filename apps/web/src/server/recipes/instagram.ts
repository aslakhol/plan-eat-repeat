import {
  canonicalInstagramMediaUrl,
  canonicalInstagramShareUrl,
  ImportRecipeError,
  instagramMediaIdFromUrl,
} from "@planeatrepeat/shared";

import {
  createSupadataInstagramAdapter,
  type SupadataInstagramEvidence,
} from "./supadata";

const ACQUISITION_TIMEOUT_MS = 30_000;
const SHARE_RESOLUTION_TIMEOUT_MS = 10_000;
const MAX_SHARE_REDIRECTS = 3;
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

export type InstagramMediaSource = {
  mediaUrl: string;
  mediaId: string;
};

const mediaSourceFromDirectUrl = (
  value: string | URL,
): InstagramMediaSource | null => {
  const mediaUrl = canonicalInstagramMediaUrl(value);
  const mediaId = mediaUrl ? instagramMediaIdFromUrl(mediaUrl) : null;
  return mediaUrl && mediaId ? { mediaUrl, mediaId } : null;
};

const redirectStatuses = new Set([301, 302, 303, 307, 308]);

export const createInstagramMediaSourceResolver =
  (
    fetchImplementation: typeof fetch,
    resolutionTimeoutMs = SHARE_RESOLUTION_TIMEOUT_MS,
  ) =>
  async (
    value: string,
    requestSignal?: AbortSignal,
  ): Promise<InstagramMediaSource | null> => {
    const directSource = mediaSourceFromDirectUrl(value);
    if (directSource) return directSource;

    const shareUrl = canonicalInstagramShareUrl(value);
    if (!shareUrl) return null;

    const timeoutSignal = AbortSignal.timeout(resolutionTimeoutMs);
    const signal = requestSignal
      ? AbortSignal.any([requestSignal, timeoutSignal])
      : timeoutSignal;
    let currentUrl = shareUrl;

    try {
      for (
        let redirectCount = 0;
        redirectCount < MAX_SHARE_REDIRECTS;
        redirectCount += 1
      ) {
        const response = await fetchImplementation(currentUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent":
              "Mozilla/5.0 (compatible; PlanEatRepeatRecipeImport/1.0)",
          },
          redirect: "manual",
          signal,
        });
        if (!redirectStatuses.has(response.status)) {
          throw new ImportRecipeError("FETCH_FAILED");
        }

        const location = response.headers.get("location");
        if (!location) throw new ImportRecipeError("FETCH_FAILED");

        const nextUrl = new URL(location, currentUrl);
        const resolvedSource = mediaSourceFromDirectUrl(nextUrl);
        if (resolvedSource) return resolvedSource;

        const nextShareUrl = canonicalInstagramShareUrl(nextUrl);
        if (!nextShareUrl) throw new ImportRecipeError("FETCH_FAILED");
        currentUrl = nextShareUrl;
      }

      throw new ImportRecipeError("FETCH_FAILED");
    } catch (error) {
      if (requestSignal?.aborted) throw error;
      if (error instanceof ImportRecipeError) throw error;
      throw new ImportRecipeError(
        "FETCH_FAILED",
        error instanceof Error ? error.message : "Instagram share failed",
      );
    }
  };

export const resolveInstagramMediaSource = (
  value: string,
  requestSignal?: AbortSignal,
) => createInstagramMediaSourceResolver(fetch)(value, requestSignal);

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
        throw new ImportRecipeError(
          evidence.transcriptUnavailable
            ? "TRANSCRIPT_UNAVAILABLE"
            : "NO_RECIPE_FOUND",
        );
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
