import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportRecipeError } from "@planeatrepeat/shared";

import { createSupadataInstagramAdapter } from "./supadata";

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

void test("Supadata acquires Instagram video metadata before a native transcript", async () => {
  const mediaId = "C7Example_1";
  const mediaUrl = `https://www.instagram.com/reel/${mediaId}/?igsh=share`;
  const requests: Array<{ headers: Headers; url: URL }> = [];
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({ headers: new Headers(init?.headers), url });

      if (url.pathname === "/v1/metadata") {
        return Promise.resolve(
          Response.json({
            platform: "instagram",
            type: "video",
            id: mediaId,
            title: "Creamy tomato pasta",
            description: "250 g pasta\n400 g tomatoes",
          }),
        );
      }

      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({
            content: "Boil the pasta and simmer the tomatoes.",
            lang: "en",
            availableLangs: ["en"],
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url.href}`));
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    mediaUrl,
    mediaId,
    new AbortController().signal,
  );

  assert.deepEqual(evidence, {
    title: "Creamy tomato pasta",
    description: "250 g pasta\n400 g tomatoes",
    transcript: "Boil the pasta and simmer the tomatoes.",
    transcriptLanguage: "en",
    transcriptUnavailable: false,
  });
  assert.deepEqual(
    requests.map(({ url }) => url.pathname),
    ["/v1/metadata", "/v1/transcript"],
  );
  const providerMediaUrl = `https://www.instagram.com/reel/${mediaId}/`;
  assert.equal(requests[0]?.url.searchParams.get("url"), providerMediaUrl);
  assert.equal(requests[1]?.url.searchParams.get("url"), providerMediaUrl);
  assert.equal(requests[1]?.url.searchParams.get("mode"), "native");
  assert.equal(requests[1]?.url.searchParams.get("text"), "true");
  assert.equal(requests[1]?.url.searchParams.has("lang"), false);
  assert.equal(requests[0]?.headers.get("x-api-key"), "test-key");
  assert.equal(requests[1]?.headers.get("x-api-key"), "test-key");
});

void test("Supadata receives a canonical URL for plural Instagram reels links", async () => {
  const mediaId = "DOybkebkcaw";
  const sharedUrl = `https://www.instagram.com/reels/${mediaId}/`;
  const providerUrls: string[] = [];
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const request = requestUrl(input);
      const providerUrl = request.searchParams.get("url") ?? "";
      providerUrls.push(providerUrl);

      if (providerUrl.includes("/reels/")) {
        return Promise.resolve(
          Response.json({ error: "invalid-request" }, { status: 400 }),
        );
      }
      if (request.pathname === "/v1/metadata") {
        return Promise.resolve(
          Response.json({
            platform: "instagram",
            type: "video",
            id: mediaId,
            title: "Pasta",
            description: "250 g pasta",
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          content: "Boil the pasta.",
          lang: "en",
          availableLangs: ["en"],
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    sharedUrl,
    mediaId,
    new AbortController().signal,
  );

  assert.equal(evidence.transcript, "Boil the pasta.");
  assert.deepEqual(providerUrls, [
    `https://www.instagram.com/reel/${mediaId}/`,
    `https://www.instagram.com/reel/${mediaId}/`,
  ]);
});

void test("Supadata starts an Instagram transcript as soon as video metadata completes", async () => {
  const mediaId = "DOybkebkcaw";
  const requestPaths: string[] = [];
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const request = requestUrl(input);
      requestPaths.push(request.pathname);

      if (request.pathname === "/v1/metadata") {
        return Promise.resolve(
          Response.json({
            platform: "instagram",
            type: "video",
            id: mediaId,
            title: "Pasta",
            description: "250 g pasta",
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          content: "Boil the pasta.",
          lang: "en",
          availableLangs: ["en"],
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    `https://www.instagram.com/reels/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );

  assert.equal(evidence.transcript, "Boil the pasta.");
  assert.deepEqual(requestPaths, ["/v1/metadata", "/v1/transcript"]);
});

for (const type of ["image", "carousel", "post"] as const) {
  void test(`Supadata uses an Instagram ${type} caption without requesting a transcript`, async () => {
    const mediaId = `Caption_${type}`;
    let requestCount = 0;
    const adapter = createSupadataInstagramAdapter({
      apiKey: "test-key",
      fetch: (() => {
        requestCount += 1;
        return Promise.resolve(
          Response.json({
            platform: "instagram",
            type,
            id: mediaId,
            title: null,
            description: "2 eggs\nWhisk and fry.",
          }),
        );
      }) as typeof fetch,
      diagnostics: { info: () => undefined, warn: () => undefined },
    });

    const evidence = await adapter.acquire(
      `https://www.instagram.com/p/${mediaId}/`,
      mediaId,
      new AbortController().signal,
    );

    assert.deepEqual(evidence, {
      title: "",
      description: "2 eggs\nWhisk and fry.",
      transcript: "",
      transcriptLanguage: null,
      transcriptUnavailable: false,
    });
    assert.equal(requestCount, 1);
  });
}

void test("Supadata keeps Instagram caption metadata when no transcript is available", async () => {
  const mediaId = "CaptionOnly";
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.pathname === "/v1/metadata"
          ? Response.json({
              platform: "instagram",
              type: "video",
              id: mediaId,
              title: "Potatoes",
              description: "Roast 500 g potatoes.",
            })
          : Response.json({ error: "transcript-unavailable" }, { status: 206 }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    `https://www.instagram.com/reel/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );

  assert.equal(evidence.description, "Roast 500 g potatoes.");
  assert.equal(evidence.transcript, "");
  assert.equal(evidence.transcriptUnavailable, true);
});

void test("Supadata keeps an Instagram caption when transcript acquisition fails", async () => {
  const mediaId = "CaptionFallback";
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.pathname === "/v1/metadata"
          ? Response.json({
              platform: "instagram",
              type: "video",
              id: mediaId,
              title: "Potatoes",
              description: "Roast 500 g potatoes.",
            })
          : Response.json({ error: "internal-error" }, { status: 500 }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    `https://www.instagram.com/reel/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );

  assert.deepEqual(evidence, {
    title: "Potatoes",
    description: "Roast 500 g potatoes.",
    transcript: "",
    transcriptLanguage: null,
    transcriptUnavailable: true,
  });
});

void test("Supadata keeps an Instagram transcript when metadata acquisition fails", async () => {
  const mediaId = "TranscriptFallback";
  const requests: URL[] = [];
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      requests.push(url);
      return Promise.resolve(
        url.pathname === "/v1/metadata"
          ? Response.json({ error: "internal-error" }, { status: 500 })
          : Response.json({
              content: "Boil the potatoes, then roast them.",
              lang: "en",
              availableLangs: ["en"],
            }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    `https://www.instagram.com/reel/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );

  assert.deepEqual(evidence, {
    title: "",
    description: "",
    transcript: "Boil the potatoes, then roast them.",
    transcriptLanguage: "en",
    transcriptUnavailable: false,
  });
  assert.deepEqual(
    requests.map((url) => url.pathname),
    ["/v1/metadata", "/v1/transcript"],
  );
});

for (const metadata of [
  { platform: "youtube", type: "video", id: "C7Example_1" },
  { platform: "instagram", type: "video", id: "DifferentId" },
] as const) {
  void test("Supadata rejects metadata for a different Instagram source", async () => {
    const adapter = createSupadataInstagramAdapter({
      apiKey: "test-key",
      fetch: (() =>
        Promise.resolve(
          Response.json({
            ...metadata,
            title: "Title",
            description: "Description",
          }),
        )) as typeof fetch,
      diagnostics: { info: () => undefined, warn: () => undefined },
    });

    await assert.rejects(
      adapter.acquire(
        "https://www.instagram.com/reel/C7Example_1/",
        "C7Example_1",
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
    );
  });
}

void test("Supadata accepts an Instagram internal ID when the canonical URL matches", async () => {
  const mediaId = "C7Example_1";
  let requestCount = 0;
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: (() => {
      requestCount += 1;
      return Promise.resolve(
        Response.json({
          platform: "instagram",
          type: "image",
          id: "17901234567890123",
          url: `https://www.instagram.com/p/${mediaId}/`,
          title: null,
          description: "2 eggs\nWhisk and fry.",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(
    `https://www.instagram.com/p/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );

  assert.equal(evidence.description, "2 eggs\nWhisk and fry.");
  assert.equal(requestCount, 1);
});

void test("Supadata maps an Instagram plan limit to the typed import error", async () => {
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.resolve(
        Response.json({ error: "limit-exceeded" }, { status: 429 }),
      )) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  await assert.rejects(
    adapter.acquire(
      "https://www.instagram.com/reel/C7Example_1/",
      "C7Example_1",
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ImportRecipeError &&
      error.code === "IMPORT_LIMIT_REACHED",
  );
});
