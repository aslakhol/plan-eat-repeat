import { BG, buildURL, GOOG_API_KEY } from "bgutils-js";
import { JSDOM } from "jsdom";
import type { TranscriptSegment } from "youtube-transcript-plus";

const BOTGUARD_REQUEST_KEY = "O43z0dpjhgX20SCx4KAo";
const YOUTUBE_ORIGIN = "https://www.youtube.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type PoTokenTranscriptParams = {
  captionUrl: string;
  languageCode?: string;
  signal: AbortSignal;
  videoId: string;
  visitorData: string;
};

type Json3Transcript = {
  events?: Array<{
    dDurationMs?: number;
    segs?: Array<{ utf8?: string }>;
    tStartMs?: number;
  }>;
};

let domInstalled = false;

export const fetchPoTokenTranscript = async ({
  captionUrl,
  languageCode,
  signal,
  videoId,
  visitorData,
}: PoTokenTranscriptParams): Promise<TranscriptSegment[]> => {
  installDom();

  const fetchWithSignal: typeof fetch = (input, init) =>
    fetch(input, { ...init, signal });
  const challenge = await BG.Challenge.create({
    fetch: fetchWithSignal,
    globalObj: globalThis,
    identifier: visitorData,
    requestKey: BOTGUARD_REQUEST_KEY,
  });
  const interpreterJavascript =
    challenge?.interpreterJavascript
      .privateDoNotAccessOrElseSafeScriptWrappedValue;
  if (!challenge || !interpreterJavascript) {
    throw new Error("YouTube did not return a BotGuard challenge");
  }

  // Google's challenge installs the VM used to prove this server executed it.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
  new Function(interpreterJavascript)();

  const botguard = await BG.BotGuardClient.create({
    program: challenge.program,
    globalName: challenge.globalName,
    globalObj: globalThis,
  });
  const webPoSignalOutput: Parameters<typeof BG.WebPoMinter.create>[1] = [];
  const botguardResponse = await botguard.snapshot({ webPoSignalOutput });
  const integrityResponse = await fetchWithSignal(
    buildURL("GenerateIT", false),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json+protobuf",
        "x-goog-api-key": GOOG_API_KEY,
        "x-user-agent": "grpc-web-javascript/0.1",
      },
      body: JSON.stringify([BOTGUARD_REQUEST_KEY, botguardResponse]),
    },
  );
  if (!integrityResponse.ok) {
    throw new Error(
      `YouTube integrity token request failed (${integrityResponse.status})`,
    );
  }

  const integrityData = (await integrityResponse.json()) as unknown[];
  const integrityToken = integrityData[0];
  if (typeof integrityToken !== "string" || !integrityToken) {
    throw new Error("YouTube did not return an integrity token");
  }

  const minter = await BG.WebPoMinter.create(
    { integrityToken },
    webPoSignalOutput,
  );
  const poToken = await minter.mintAsWebsafeString(videoId);
  botguard.shutdown();

  const url = new URL(captionUrl);
  url.searchParams.set("fmt", "json3");
  url.searchParams.set("pot", poToken);
  url.searchParams.set("c", "WEB");
  const response = await fetch(url, {
    headers: { Origin: YOUTUBE_ORIGIN, "User-Agent": USER_AGENT },
    signal,
  });
  if (!response.ok) {
    throw new Error(`YouTube caption request failed (${response.status})`);
  }

  const body = await response.text();
  if (!body) throw new Error("YouTube returned an empty caption response");

  return parseJson3Transcript(body, languageCode ?? "");
};

export const parseJson3Transcript = (
  body: string,
  languageCode: string,
): TranscriptSegment[] => {
  const transcript = JSON.parse(body) as Json3Transcript;

  return (transcript.events ?? []).flatMap((event) => {
    if (!event.segs) return [];

    const text = event.segs
      .map((segment) => segment.utf8 ?? "")
      .join("")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return [];

    return [
      {
        text,
        duration: (event.dDurationMs ?? 0) / 1_000,
        offset: (event.tStartMs ?? 0) / 1_000,
        lang: languageCode,
      },
    ];
  });
};

const installDom = () => {
  if (domInstalled) return;

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: `${YOUTUBE_ORIGIN}/`,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    location: dom.window.location,
    origin: dom.window.origin,
  });
  domInstalled = true;
};
