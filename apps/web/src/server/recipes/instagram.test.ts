import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  createInstagramMediaSourceResolver,
  createInstagramRecipeTextAcquirer,
} from "./instagram";

const mediaUrl = "https://www.instagram.com/reel/C7Example_1/";
const mediaId = "C7Example_1";

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

void test("Instagram direct media variants normalize without a network request", async () => {
  let requestCount = 0;
  const resolveInstagramMediaSource = createInstagramMediaSourceResolver(
    (() => {
      requestCount += 1;
      return Promise.reject(new Error("Direct URLs must not be fetched"));
    }) as typeof fetch,
  );

  for (const url of [
    "https://m.instagram.com/reels/DOybkebkcaw/?igsh=tracking",
    "https://www.instagram.com/iankyo/reel/DOybkebkcaw/",
    "https://www.instagram.com/reel/DOybkebkcaw/embed/captioned/",
  ]) {
    assert.deepEqual(await resolveInstagramMediaSource(url), {
      mediaId: "DOybkebkcaw",
      mediaUrl: "https://www.instagram.com/reel/DOybkebkcaw/",
    });
  }
  assert.equal(requestCount, 0);
});

void test("Instagram opaque Reel shares resolve to their canonical media URL", async () => {
  const requests: URL[] = [];
  const resolveInstagramMediaSource = createInstagramMediaSourceResolver(((
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    requests.push(requestUrl(input));
    assert.equal(init?.redirect, "manual");
    return Promise.resolve(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://www.instagram.com/reel/DB0YWyzPdcX/?igsh=tracking",
        },
      }),
    );
  }) as typeof fetch);

  assert.deepEqual(
    await resolveInstagramMediaSource(
      "https://m.instagram.com/share/reel/_69O6RoGd/?utm_source=copy",
    ),
    {
      mediaId: "DB0YWyzPdcX",
      mediaUrl: "https://www.instagram.com/reel/DB0YWyzPdcX/",
    },
  );
  assert.deepEqual(
    requests.map((url) => url.href),
    ["https://www.instagram.com/share/reel/_69O6RoGd/"],
  );
});

for (const [sharePath, destination] of [
  ["share/BA2FWY8aBb", "p/C_0x-tLNM-c"],
  ["share/p/BALv9Ep4YH", "p/DC2konOtSse"],
] as const) {
  void test(`Instagram ${sharePath} links resolve before acquisition`, async () => {
    const resolveInstagramMediaSource = createInstagramMediaSourceResolver(
      (() =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: {
              location: `https://www.instagram.com/${destination}/`,
            },
          }),
        )) as typeof fetch,
    );

    const mediaId = destination.split("/").at(-1)!;
    assert.deepEqual(
      await resolveInstagramMediaSource(
        `https://www.instagram.com/${sharePath}/`,
      ),
      {
        mediaId,
        mediaUrl: `https://www.instagram.com/${destination}/`,
      },
    );
  });
}

void test("Instagram share resolution rejects redirects outside Instagram", async () => {
  const resolveInstagramMediaSource = createInstagramMediaSourceResolver((() =>
    Promise.resolve(
      new Response(null, {
        status: 302,
        headers: { location: "https://example.com/reel/DB0YWyzPdcX/" },
      }),
    )) as typeof fetch);

  await assert.rejects(
    resolveInstagramMediaSource(
      "https://www.instagram.com/share/reel/_69O6RoGd/",
    ),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
});

void test("Instagram share resolution propagates caller cancellation", async () => {
  const cancellation = new Error("request cancelled");
  const controller = new AbortController();
  const resolveInstagramMediaSource = createInstagramMediaSourceResolver(
    ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(cancellation), {
          once: true,
        });
      })) as typeof fetch,
  );

  const result = resolveInstagramMediaSource(
    "https://www.instagram.com/share/reel/_69O6RoGd/",
    controller.signal,
  );
  controller.abort(cancellation);

  await assert.rejects(result, (error: unknown) => error === cancellation);
});

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
        transcriptUnavailable: false,
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
        transcriptUnavailable: false,
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
        transcriptUnavailable: true,
      }),
  });

  const text = await acquireInstagramRecipeText(mediaUrl, mediaId);

  assert.match(text, /Instagram caption:\nBoil the potatoes/);
  assert.match(text, /Transcript:\n$/);
});

void test("Instagram import reports when a video has no caption or transcript", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "A title is not a recipe",
        description: "  ",
        transcript: "",
        transcriptLanguage: null,
        transcriptUnavailable: true,
      }),
  });

  await assert.rejects(
    acquireInstagramRecipeText(mediaUrl, mediaId),
    (error: unknown) =>
      error instanceof ImportRecipeError &&
      error.code === "TRANSCRIPT_UNAVAILABLE",
  );
});

void test("Instagram import keeps the general error for a post without a caption", async () => {
  const acquireInstagramRecipeText = createInstagramRecipeTextAcquirer({
    acquire: () =>
      Promise.resolve({
        title: "An image post",
        description: "",
        transcript: "",
        transcriptLanguage: null,
        transcriptUnavailable: false,
      }),
  });

  await assert.rejects(
    acquireInstagramRecipeText(mediaUrl, mediaId),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "NO_RECIPE_FOUND",
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
