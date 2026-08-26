import assert from "node:assert/strict";
import { after, mock, test } from "node:test";

import { acquireYouTubeRecipeText } from "./youtube";

const originalFetch = globalThis.fetch;

after(() => {
  globalThis.fetch = originalFetch;
});

void test("YouTube imports use playable data from the watch page when the player API is rejected", async () => {
  const videoId = "BoFkDmTm2uc";
  const embeddedPlayer = {
    playabilityStatus: { status: "OK" },
    videoDetails: {
      title: "Five-Ingredient Biscuits and Sausage Gravy",
      shortDescription: "1 cup flour\n1 cup heavy cream\nBake until golden.",
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: "https://captions.example/transcript",
            kind: "asr",
          },
        ],
      },
    },
  };
  let playerApiCalls = 0;

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    if (url.hostname === "www.youtube.com" && url.pathname === "/watch") {
      return Promise.resolve(
        new Response(
          `<script>var ytInitialPlayerResponse = ${JSON.stringify(embeddedPlayer)};</script>` +
            '<script>ytcfg.set({"INNERTUBE_API_KEY":"test-key"});</script>',
          { status: 200, headers: { "Content-Type": "text/html" } },
        ),
      );
    }

    if (url.pathname === "/youtubei/v1/player") {
      playerApiCalls += 1;
      return Promise.resolve(
        Response.json({
          playabilityStatus: {
            status: "LOGIN_REQUIRED",
            reason: "Sign in to confirm you're not a bot",
          },
        }),
      );
    }

    if (url.hostname === "captions.example") {
      return Promise.resolve(
        new Response("", {
          status: 200,
          headers: { "Content-Type": "text/html; charset=UTF-8" },
        }),
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${url.href}`));
  }) as typeof fetch;

  const text = await acquireYouTubeRecipeText(
    videoId,
    undefined,
    ({ captionUrl, videoId: fallbackVideoId }) => {
      assert.equal(captionUrl, "https://captions.example/transcript");
      assert.equal(fallbackVideoId, videoId);
      return Promise.resolve([
        {
          text: "Whisk the cream into the flour",
          duration: 3,
          offset: 0,
          lang: "en",
        },
      ]);
    },
  );

  assert.match(text, /Five-Ingredient Biscuits and Sausage Gravy/);
  assert.match(text, /1 cup flour/);
  assert.match(text, /Whisk the cream into the flour/);
  assert.equal(playerApiCalls, 1);
});

void test("YouTube imports use embedded watch data when the InnerTube API key is missing", async () => {
  const videoId = "YdFjuglEAds";
  const embeddedPlayer = {
    playabilityStatus: { status: "OK" },
    videoDetails: {
      title: "Crispy Garlic Butter Potatoes",
      shortDescription: "Boil the potatoes, then roast until crisp.",
    },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [
          {
            baseUrl: "https://captions.example/protected-transcript",
            kind: "asr",
            languageCode: "en",
          },
        ],
      },
    },
  };
  let playerApiCalls = 0;

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    if (url.hostname === "www.youtube.com" && url.pathname === "/watch") {
      return Promise.resolve(
        new Response(
          `<script>ytInitialPlayerResponse = ${JSON.stringify(embeddedPlayer)};</script>`,
          { status: 200, headers: { "Content-Type": "text/html" } },
        ),
      );
    }

    if (url.pathname === "/youtubei/v1/player") {
      playerApiCalls += 1;
      return Promise.resolve(
        Response.json({ playabilityStatus: { status: "LOGIN_REQUIRED" } }),
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${url.href}`));
  }) as typeof fetch;

  const text = await acquireYouTubeRecipeText(
    videoId,
    undefined,
    ({ captionUrl }) => {
      assert.equal(
        captionUrl,
        "https://captions.example/protected-transcript",
      );
      return Promise.resolve([
        {
          text: "Toss the potatoes with garlic butter",
          duration: 3,
          offset: 0,
          lang: "en",
        },
      ]);
    },
  );

  assert.match(text, /Crispy Garlic Butter Potatoes/);
  assert.match(text, /Boil the potatoes/);
  assert.match(text, /Toss the potatoes with garlic butter/);
  assert.equal(playerApiCalls, 0);
});

void test("YouTube import failures log sanitized acquisition diagnostics", async () => {
  const videoId = "nHDNtxvrhHc";
  const warning = mock.method(console, "warn", () => undefined);

  globalThis.fetch = mock.fn((input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );

    if (url.hostname === "www.youtube.com" && url.pathname === "/watch") {
      return Promise.resolve(
        new Response('<div class="g-recaptcha">Blocked</div>', {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );
    }

    return Promise.reject(new Error(`Unexpected request: ${url.href}`));
  }) as typeof fetch;

  await assert.rejects(
    acquireYouTubeRecipeText(videoId),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "FETCH_FAILED",
  );

  const callArguments = (warning.mock.calls[0]?.arguments ?? []) as unknown[];
  assert.equal(
    callArguments[0],
    "YouTube import could not acquire video details",
  );
  assert.deepEqual(callArguments[1], {
    videoId,
    watchHttpStatus: 200,
    watchHasInnerTubeApiKey: false,
    watchHasRecaptcha: true,
    embeddedPlayabilityStatus: undefined,
    embeddedHasVideoDetails: false,
    embeddedCaptionTrackCount: 0,
    transcriptError: "YoutubeTranscriptTooManyRequestError",
    aborted: false,
  });

  warning.mock.restore();
});
