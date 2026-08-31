import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  acquireYouTubeVideoTitle,
  createYouTubeRecipeTextAcquirer,
} from "./youtube";

const productionRegressionVideoIds = [
  "BoFkDmTm2uc",
  "YdFjuglEAds",
  "nHDNtxvrhHc",
];

for (const videoId of productionRegressionVideoIds) {
  void test(`YouTube import builds recipe evidence for ${videoId}`, async () => {
    const requestedVideoIds: string[] = [];
    const acquireYouTubeRecipeText = createYouTubeRecipeTextAcquirer({
      acquire: (requestedVideoId, signal) => {
        assert.equal(signal.aborted, false);
        requestedVideoIds.push(requestedVideoId);
        return Promise.resolve({
          title: "Five-Ingredient Biscuits and Sausage Gravy",
          description: "1 cup flour\n1 cup heavy cream",
          transcript: "Whisk the cream into the flour.",
          transcriptLanguage: "en",
        });
      },
    });

    const text = await acquireYouTubeRecipeText(videoId);

    assert.equal(
      text,
      "YouTube title:\nFive-Ingredient Biscuits and Sausage Gravy\n\n" +
        "YouTube description:\n1 cup flour\n1 cup heavy cream\n\n" +
        "Caption transcript:\nWhisk the cream into the flour.",
    );
    assert.deepEqual(requestedVideoIds, [videoId]);
  });
}

void test("YouTube import caps evidence without discarding metadata", async () => {
  const acquireYouTubeRecipeText = createYouTubeRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "T".repeat(1_000),
        description: "D".repeat(10_000),
        transcript: "S".repeat(50_000),
        transcriptLanguage: "en",
      }),
  });

  const text = await acquireYouTubeRecipeText("BoFkDmTm2uc");

  assert.equal(text.length, 40_000);
  assert.match(text, /^YouTube title:\nT{488}\n\[truncated\]/);
  assert.match(text, /YouTube description:\nD{7988}\n\[truncated\]/);
  assert.match(text, /Caption transcript:\nS+\n\[truncated\]$/);
});

void test("YouTube import rejects evidence without a description or transcript", async () => {
  const acquireYouTubeRecipeText = createYouTubeRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "A title is not a recipe",
        description: "  ",
        transcript: "",
        transcriptLanguage: null,
      }),
  });

  await assert.rejects(
    acquireYouTubeRecipeText("BoFkDmTm2uc"),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "NO_RECIPE_FOUND",
  );
});

void test("YouTube import preserves a description-only recipe", async () => {
  const acquireYouTubeRecipeText = createYouTubeRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "Crispy potatoes",
        description: "Boil the potatoes, then roast until crisp.",
        transcript: "",
        transcriptLanguage: null,
      }),
  });

  const text = await acquireYouTubeRecipeText("YdFjuglEAds");

  assert.match(text, /YouTube description:\nBoil the potatoes/);
  assert.match(text, /Caption transcript:\n$/);
});

void test("YouTube import propagates caller cancellation", async () => {
  const cancellation = new Error("request cancelled");
  const controller = new AbortController();
  const acquireYouTubeRecipeText = createYouTubeRecipeTextAcquirer({
    acquire: (_videoId, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () =>
            reject(
              signal.reason instanceof Error
                ? signal.reason
                : new Error("acquisition aborted"),
            ),
          { once: true },
        );
      }),
  });

  const result = acquireYouTubeRecipeText("BoFkDmTm2uc", controller.signal);
  controller.abort(cancellation);

  await assert.rejects(result, (error: unknown) => error === cancellation);
});

void test("YouTube title preview remains an independent oEmbed request", async () => {
  const originalFetch = globalThis.fetch;
  const requests: URL[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    requests.push(url);
    return Promise.resolve(Response.json({ title: "  Preview title  " }));
  }) as typeof fetch;

  try {
    assert.equal(
      await acquireYouTubeVideoTitle("BoFkDmTm2uc"),
      "Preview title",
    );
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.hostname, "www.youtube.com");
    assert.equal(requests[0]?.pathname, "/oembed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("YouTube title preview returns null when oEmbed fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() =>
    Promise.reject(new Error("oEmbed unavailable"))) as typeof fetch;

  try {
    assert.equal(await acquireYouTubeVideoTitle("YdFjuglEAds"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
