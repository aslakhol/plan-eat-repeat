import { ImportRecipeError } from "@planeatrepeat/shared";
import {
  fetchTranscript,
  type FetchParams,
  type TranscriptSegment,
} from "youtube-transcript-plus";

import { fetchPoTokenTranscript } from "./youtube-po-token";

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
  languageCode?: string;
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
  poTokenTranscriptFetch = fetchPoTokenTranscript,
) => {
  const timeoutSignal = AbortSignal.timeout(ACQUISITION_TIMEOUT_MS);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, timeoutSignal])
    : timeoutSignal;
  const { videoDetails, transcript } = await fetchYouTubeData(
    videoId,
    signal,
    poTokenTranscriptFetch,
  );
  const description = videoDetails.shortDescription?.trim() ?? "";
  const transcriptText = transcript.map((segment) => segment.text).join(" ");

  return `YouTube title:\n${videoDetails.title ?? ""}\n\nYouTube description:\n${description}\n\nCaption transcript:\n${transcriptText}`;
};

const fetchYouTubeData = async (
  videoId: string,
  signal: AbortSignal,
  poTokenTranscriptFetch: typeof fetchPoTokenTranscript,
) => {
  let automaticFallbackUrl: string | null = null;
  let embeddedPlayer: YouTubePlayerResponse | null = null;
  let visitorData = "";
  const diagnostics: {
    embeddedCaptionTrackCount?: number;
    embeddedHasVideoDetails?: boolean;
    embeddedPlayabilityStatus?: string;
    playerError?: string;
    playerHttpStatus?: number;
    playerPlayabilityStatus?: string;
    transcriptError?: string;
    watchHasInnerTubeApiKey?: boolean;
    watchHasRecaptcha?: boolean;
    watchError?: string;
    watchHttpStatus?: number;
  } = {};
  const acquired: {
    poTokenFallbackTrack: CaptionTrack | null;
    videoDetails: YouTubeVideoDetails | null;
  } = {
    poTokenFallbackTrack: null,
    videoDetails: null,
  };

  const capturePlayerData = (player: YouTubePlayerResponse) => {
    if (isUsablePlayer(player)) {
      acquired.videoDetails = player.videoDetails;
    }

    const tracks = [...(captionTracks(player) ?? [])].sort(
      (left, right) => Number(isAutomatic(left)) - Number(isAutomatic(right)),
    );
    if (tracks[0] && !isAutomatic(tracks[0])) {
      automaticFallbackUrl = trackUrl(tracks.find(isAutomatic));
    }
    acquired.poTokenFallbackTrack =
      tracks[0] ?? acquired.poTokenFallbackTrack;
  };

  const videoFetch = async (params: FetchParams) => {
    let response: Response;
    try {
      response = await fetchFromParams(params);
    } catch (error) {
      diagnostics.watchError = errorLabel(error);
      throw error;
    }
    diagnostics.watchHttpStatus = response.status;
    if (!response.ok) return response;

    const body = await response.text();
    embeddedPlayer = embeddedPlayerResponse(body);
    visitorData = embeddedVisitorData(body);
    diagnostics.watchHasInnerTubeApiKey = hasInnerTubeApiKey(body);
    diagnostics.watchHasRecaptcha = body.includes('class="g-recaptcha"');
    diagnostics.embeddedPlayabilityStatus =
      embeddedPlayer?.playabilityStatus?.status;
    diagnostics.embeddedHasVideoDetails = Boolean(embeddedPlayer?.videoDetails);
    diagnostics.embeddedCaptionTrackCount = embeddedPlayer
      ? (captionTracks(embeddedPlayer)?.length ?? 0)
      : 0;
    if (embeddedPlayer) capturePlayerData(embeddedPlayer);

    return responseWithBody(response, body, "text/html");
  };

  const playerFetch = async (params: FetchParams) => {
    let response: Response;
    let player: YouTubePlayerResponse;

    try {
      response = await fetchFromParams(params);
      diagnostics.playerHttpStatus = response.status;
      if (!response.ok) {
        if (!isUsablePlayer(embeddedPlayer)) return response;
        response = Response.json(embeddedPlayer);
      }

      const upstreamPlayer = (await response.json()) as YouTubePlayerResponse;
      diagnostics.playerPlayabilityStatus =
        upstreamPlayer.playabilityStatus?.status;
      player = isUsablePlayer(upstreamPlayer)
        ? upstreamPlayer
        : isUsablePlayer(embeddedPlayer)
          ? embeddedPlayer
          : upstreamPlayer;
    } catch (error) {
      diagnostics.playerError = errorLabel(error);
      if (!isUsablePlayer(embeddedPlayer)) throw error;
      response = Response.json(embeddedPlayer);
      player = embeddedPlayer;
    }

    capturePlayerData(player);

    return responseWithBody(
      response,
      JSON.stringify(player),
      "application/json",
    );
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
      videoFetch,
      playerFetch,
      transcriptFetch,
    });
  } catch (error) {
    diagnostics.transcriptError = errorLabel(error);
    // The watch-page data and PO-token fallback below may still be usable.
  }

  const poTokenCaptionUrl = trackUrl(
    acquired.poTokenFallbackTrack ?? undefined,
  );
  if (transcript.length === 0 && poTokenCaptionUrl) {
    try {
      transcript = await poTokenTranscriptFetch({
        captionUrl: poTokenCaptionUrl,
        languageCode: acquired.poTokenFallbackTrack?.languageCode,
        signal,
        videoId,
        visitorData,
      });
    } catch (error) {
      console.warn("YouTube PoToken transcript fallback failed", {
        videoId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (!acquired.videoDetails) {
    console.warn("YouTube import could not acquire video details", {
      videoId,
      ...diagnostics,
      aborted: signal.aborted,
    });
    throw new ImportRecipeError("FETCH_FAILED");
  }

  return { videoDetails: acquired.videoDetails, transcript };
};

const isUsablePlayer = (
  player: YouTubePlayerResponse | null,
): player is YouTubePlayerResponse & { videoDetails: YouTubeVideoDetails } =>
  player?.playabilityStatus?.status === "OK" && Boolean(player.videoDetails);

const embeddedPlayerResponse = (html: string): YouTubePlayerResponse | null => {
  const assignment = /ytInitialPlayerResponse\s*=\s*/.exec(html);
  if (!assignment) return null;

  const start = html.indexOf("{", assignment.index + assignment[0].length);
  if (start < 0) return null;

  const json = jsonObjectAt(html, start);
  if (!json) return null;

  try {
    return JSON.parse(json) as YouTubePlayerResponse;
  } catch {
    return null;
  }
};

const embeddedVisitorData = (html: string) =>
  /"visitorData":"([^"]+)"/.exec(html)?.[1] ?? "";

const hasInnerTubeApiKey = (html: string) =>
  /"INNERTUBE_API_KEY":"[^"]+"/.test(html) ||
  /INNERTUBE_API_KEY\\":\\"[^\\"]+\\"/.test(html);

const errorLabel = (error: unknown) =>
  error instanceof Error ? error.name : typeof error;

const jsonObjectAt = (text: string, start: number) => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
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

const responseWithBody = (
  response: Response,
  body: string,
  fallbackContentType: string,
) =>
  new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? fallbackContentType,
    },
  });
