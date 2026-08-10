import { ImportRecipeError } from "@planeatrepeat/shared";
import {
  fetchTranscript,
  type FetchParams,
  type TranscriptSegment,
} from "youtube-transcript-plus";

const ACQUISITION_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeatRecipeImport/1.0";

type YouTubeVideoDetails = {
  title?: string;
  shortDescription?: string;
};

type CaptionTrack = {
  baseUrl?: string;
  url?: string;
  kind?: string;
};

type YouTubePlayerResponse = {
  playabilityStatus?: { status?: string };
  videoDetails?: YouTubeVideoDetails;
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
  playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
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

export const acquireYouTubeRecipeText = async (
  videoId: string,
  requestSignal?: AbortSignal,
) => {
  const timeoutSignal = AbortSignal.timeout(ACQUISITION_TIMEOUT_MS);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal;
  const { videoDetails, transcript } = await fetchYouTubeData(videoId, signal);
  const description = videoDetails.shortDescription?.trim() ?? "";
  const transcriptText = transcript.map((segment) => segment.text).join(" ");

  return `YouTube title:\n${videoDetails.title ?? ""}\n\nYouTube description:\n${description}\n\nCaption transcript:\n${transcriptText}`;
};

const fetchYouTubeData = async (videoId: string, signal: AbortSignal) => {
  let automaticFallbackUrl: string | null = null;
  const acquired: { videoDetails: YouTubeVideoDetails | null } = {
    videoDetails: null,
  };

  const playerFetch = async (params: FetchParams) => {
    const response = await fetchFromParams(params);
    if (!response.ok) return response;

    const player = (await response.json()) as YouTubePlayerResponse;
    if (player.playabilityStatus?.status === "OK" && player.videoDetails) {
      acquired.videoDetails = player.videoDetails;
    }

    const tracks = captionTracks(player);
    if (tracks) {
      tracks.sort(
        (left, right) => Number(isAutomatic(left)) - Number(isAutomatic(right)),
      );
      if (tracks[0] && !isAutomatic(tracks[0])) {
        automaticFallbackUrl = trackUrl(tracks.find(isAutomatic));
      }
    }

    return new Response(JSON.stringify(player), {
      status: response.status,
      statusText: response.statusText,
      headers: { "Content-Type": "application/json" },
    });
  };

  const transcriptFetch = async (params: FetchParams) => {
    try {
      const primary = await fetchFromParams(params);
      if (!automaticFallbackUrl) return primary;

      if (primary.ok) {
        const body = await primary.text();
        if (body.includes("<text")) {
          return new Response(body, {
            status: primary.status,
            statusText: primary.statusText,
            headers: {
              "Content-Type": primary.headers.get("Content-Type") ?? "text/xml",
            },
          });
        }
      }
    } catch (error) {
      if (!automaticFallbackUrl || signal.aborted) throw error;
    }

    return fetchFromParams(params, automaticFallbackUrl);
  };

  let transcript: TranscriptSegment[] = [];
  try {
    transcript = await fetchTranscript(videoId, {
      userAgent: USER_AGENT,
      signal,
      playerFetch,
      transcriptFetch,
    });
  } catch {
    // Written descriptions are sufficient; caption retrieval is best effort.
  }

  if (!acquired.videoDetails) throw new ImportRecipeError("FETCH_FAILED");

  return { videoDetails: acquired.videoDetails, transcript };
};

const captionTracks = (player: YouTubePlayerResponse) =>
  player.captions?.playerCaptionsTracklistRenderer?.captionTracks ??
  player.playerCaptionsTracklistRenderer?.captionTracks;

const isAutomatic = (track: CaptionTrack) => track.kind === "asr";

const trackUrl = (track?: CaptionTrack) =>
  (track?.baseUrl ?? track?.url ?? null)?.replace(/&fmt=[^&]+/, "") ?? null;

const fetchFromParams = (params: FetchParams, url = params.url) => {
  const headers = new Headers(params.headers);
  if (params.lang) headers.set("Accept-Language", params.lang);
  if (params.userAgent) headers.set("User-Agent", params.userAgent);

  return fetch(url, {
    method: params.method,
    headers,
    body: params.body,
    signal: params.signal,
  });
};
