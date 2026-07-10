import { ImportRecipeError } from "@planeatrepeat/shared";
import {
  fetchTranscript,
  type FetchParams,
  type TranscriptSegment,
} from "youtube-transcript-plus";

import { env } from "~/env";

const ACQUISITION_TIMEOUT_MS = 20_000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 PlanEatRepeatRecipeImport/1.0";

type YouTubeVideoResponse = {
  items?: Array<{
    snippet?: { title?: string; description?: string };
    contentDetails?: { contentRating?: { ytRating?: string } };
  }>;
};

type CaptionTrack = {
  baseUrl?: string;
  url?: string;
  kind?: string;
};

type YouTubePlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
  playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
};

export const acquireYouTubeRecipeText = async (videoId: string) => {
  const apiKey = env.YOUTUBE_API_KEY;
  if (!apiKey) throw new ImportRecipeError("FETCH_FAILED");

  const signal = AbortSignal.timeout(ACQUISITION_TIMEOUT_MS);
  const [video, transcript] = await Promise.all([
    fetchVideo(videoId, apiKey, signal),
    fetchPreferredTranscript(videoId, signal),
  ]);
  const description = video.snippet?.description?.trim() ?? "";
  const transcriptText = transcript.map((segment) => segment.text).join(" ");

  return `YouTube title:\n${video.snippet?.title ?? ""}\n\nYouTube description:\n${description}\n\nCaption transcript:\n${transcriptText}`;
};

const fetchVideo = async (
  videoId: string,
  apiKey: string,
  signal: AbortSignal,
) => {
  try {
    const apiUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    apiUrl.searchParams.set("part", "snippet,contentDetails");
    apiUrl.searchParams.set("id", videoId);
    apiUrl.searchParams.set("key", apiKey);

    const response = await fetch(apiUrl, { signal });
    if (!response.ok) throw new ImportRecipeError("FETCH_FAILED");

    const data = (await response.json()) as YouTubeVideoResponse;
    const video = data.items?.[0];
    if (
      !video?.snippet ||
      video.contentDetails?.contentRating?.ytRating === "ytAgeRestricted"
    ) {
      throw new ImportRecipeError("FETCH_FAILED");
    }

    return video;
  } catch (error) {
    if (error instanceof ImportRecipeError) throw error;
    throw new ImportRecipeError("FETCH_FAILED");
  }
};

const fetchPreferredTranscript = async (
  videoId: string,
  signal: AbortSignal,
): Promise<TranscriptSegment[]> => {
  let automaticFallbackUrl: string | null = null;

  const playerFetch = async (params: FetchParams) => {
    const response = await fetchFromParams(params);
    if (!response.ok) return response;

    const player = (await response.json()) as YouTubePlayerResponse;
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

  try {
    return await fetchTranscript(videoId, {
      userAgent: USER_AGENT,
      signal,
      playerFetch,
      transcriptFetch,
    });
  } catch {
    // Written descriptions are sufficient; caption retrieval is best effort.
    return [];
  }
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
