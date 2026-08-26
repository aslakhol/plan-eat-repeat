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
