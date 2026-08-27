import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportRecipeError } from "@planeatrepeat/shared";

import { createInstagramRecipeTextAcquirer } from "./instagram";

const mediaUrl = "https://www.instagram.com/reel/C7Example_1/";
const mediaId = "C7Example_1";

void test("Instagram import builds bounded recipe evidence from caption and transcript", async () => {
  const requestedSources: Array<{ mediaId: string; mediaUrl: string }> = [];
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: (requestedUrl, requestedId, signal) => {
      assert.equal(signal.aborted, false);
      requestedSources.push({ mediaUrl: requestedUrl, mediaId: requestedId });
      return Promise.resolve({
        title: "Creamy tomato pasta",
        description: "250 g pasta\n400 g tomatoes",
        transcript: "Boil the pasta and simmer the tomatoes.",
        transcriptLanguage: "en",
      });
    },
  });

  const text = await acquireInstagramRecipeText(mediaUrl, mediaId);

  assert.equal(
    text,
    "Instagram title:\nCreamy tomato pasta\n\n" +
      "Instagram caption:\n250 g pasta\n400 g tomatoes\n\n" +
      "Transcript:\nBoil the pasta and simmer the tomatoes.",
  );
  assert.deepEqual(requestedSources, [{ mediaUrl, mediaId }]);
});

void test("Instagram import caps evidence without discarding caption metadata", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "T".repeat(1_000),
        description: "D".repeat(10_000),
        transcript: "S".repeat(50_000),
        transcriptLanguage: "en",
      }),
  });

  const text = await acquireInstagramRecipeText(mediaUrl, mediaId);

  assert.equal(text.length, 40_000);
  assert.match(text, /^Instagram title:\nT{488}\n\[truncated\]/);
  assert.match(text, /Instagram caption:\nD{7988}\n\[truncated\]/);
  assert.match(text, /Transcript:\nS+\n\[truncated\]$/);
});

void test("Instagram import accepts a written caption without a transcript", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "Crispy potatoes",
        description: "Boil the potatoes, then roast until crisp.",
        transcript: "",
        transcriptLanguage: null,
      }),
  });

  const text = await acquireInstagramRecipeText(mediaUrl, mediaId);

  assert.match(text, /Instagram caption:\nBoil the potatoes/);
  assert.match(text, /Transcript:\n$/);
});

void test("Instagram import rejects evidence without a caption or transcript", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "A title is not a recipe",
        description: "  ",
        transcript: "",
        transcriptLanguage: null,
      }),
  });

  await assert.rejects(
    acquireInstagramRecipeText(mediaUrl, mediaId),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "NO_RECIPE_FOUND",
  );
});

void test("Instagram import maps its acquisition deadline to FETCH_FAILED", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer(
    {
      acquire: (_mediaUrl, _mediaId, signal) =>
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
    },
    1,
  );

  await assert.rejects(
    acquireInstagramRecipeText(mediaUrl, mediaId),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
});

void test("Instagram import propagates caller cancellation", async () => {
  const cancellation = new Error("request cancelled");
  const controller = new AbortController();
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: (_mediaUrl, _mediaId, signal) =>
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

  const result = acquireInstagramRecipeText(
    mediaUrl,
    mediaId,
    controller.signal,
  );
  controller.abort(cancellation);

  await assert.rejects(result, (error: unknown) => error === cancellation);
});
