import assert from "node:assert/strict";
import { test } from "node:test";

import { ImportRecipeError } from "@planeatrepeat/shared";

import {
  createSupadataInstagramAdapter,
  createSupadataYouTubeAdapter,
} from "./supadata";
import type { SupadataSpendObserver } from "./supadata-spend";
import { createSupadataWebAdapter } from "./supadataWeb";

const silentDiagnostics = {
  info: () => undefined,
  warn: () => undefined,
};

const spendLog = () => {
  const events: Array<string | number> = [];
  const observer: SupadataSpendObserver = {
    onOperationStarted: () => {
      events.push("started");
    },
    onCreditsKnown: (credits) => {
      events.push(credits);
    },
  };
  return { events, observer };
};

const successfulWebResponse = (headers?: HeadersInit) =>
  Response.json(
    {
      url: "https://example.com/recipe",
      content: "# Soup\n\nSimmer it.",
      countCharacters: 19,
      urls: [],
    },
    { headers },
  );

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

void test("a valid billing header settles a metered operation before response parsing", async () => {
  const { events, observer } = spendLog();
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.resolve(
        Response.json(
          { error: "invalid-request" },
          { status: 400, headers: { "x-billable-requests": "3" } },
        ),
      )) as typeof fetch,
    diagnostics: silentDiagnostics,
    spendObserver: observer,
  });

  await assert.rejects(
    adapter.scrape("https://example.com/recipe", new AbortController().signal),
    (error: unknown) => error instanceof ImportRecipeError,
  );
  assert.deepEqual(events, ["started", 3]);
});

void test("a completed web scrape without a valid header settles its fixed credit", async () => {
  for (const header of [null, "invalid"]) {
    const { events, observer } = spendLog();
    const adapter = createSupadataWebAdapter({
      apiKey: "test-key",
      fetch: (() =>
        Promise.resolve(
          successfulWebResponse(
            header === null ? undefined : { "x-billable-requests": header },
          ),
        )) as typeof fetch,
      diagnostics: silentDiagnostics,
      spendObserver: observer,
    });

    await adapter.scrape(
      "https://example.com/recipe",
      new AbortController().signal,
    );
    assert.deepEqual(events, ["started", 1]);
  }
});

void test("provider, transport, and cancelled requests without billing data remain unknown", async () => {
  for (const failure of ["provider", "transport", "cancelled"] as const) {
    const { events, observer } = spendLog();
    const controller = new AbortController();
    const adapter = createSupadataWebAdapter({
      apiKey: "test-key",
      fetch: (() => {
        if (failure === "provider") {
          return Promise.resolve(
            Response.json({ error: "provider-failed" }, { status: 500 }),
          );
        }
        if (failure === "cancelled") controller.abort();
        return Promise.reject(
          failure === "cancelled"
            ? new DOMException("The operation was aborted", "AbortError")
            : new Error("transport failed"),
        );
      }) as typeof fetch,
      diagnostics: silentDiagnostics,
      spendObserver: observer,
    });

    await assert.rejects(
      adapter.scrape("https://example.com/recipe", controller.signal),
    );
    assert.deepEqual(events, ["started"], failure);
  }
});

void test("native transcript, HTTP 206, and metadata completions settle fixed credits", async () => {
  for (const transcriptStatus of [200, 206]) {
    const { events, observer } = spendLog();
    const videoId = `video-${transcriptStatus}`;
    const adapter = createSupadataYouTubeAdapter({
      apiKey: "test-key",
      spendObserver: observer,
      diagnostics: silentDiagnostics,
      fetch: ((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.pathname === "/v1/transcript") {
          return Promise.resolve(
            transcriptStatus === 206
              ? Response.json(
                  { error: "transcript-unavailable" },
                  { status: 206 },
                )
              : Response.json({
                  content: "Simmer it.",
                  lang: "en",
                  availableLangs: ["en"],
                }),
          );
        }
        return Promise.resolve(
          Response.json({
            platform: "youtube",
            type: "video",
            id: videoId,
            title: "Soup",
            description: "Simmer it.",
          }),
        );
      }) as typeof fetch,
    });

    await adapter.acquire(videoId, new AbortController().signal);
    assert.deepEqual(events, ["started", "started", 1, 1]);
  }
});

void test("transcript job polling is free and settles the original operation on completion", async () => {
  const { events, observer } = spendLog();
  const videoId = "async-video";
  let pollCount = 0;
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 0,
    spendObserver: observer,
    diagnostics: silentDiagnostics,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "job-1" }, { status: 202 }),
        );
      }
      if (url.pathname === "/v1/transcript/job-1") {
        pollCount += 1;
        return Promise.resolve(
          pollCount === 1
            ? Response.json({ status: "active" })
            : Response.json({
                status: "completed",
                content: "Simmer it.",
                lang: "en",
                availableLangs: ["en"],
              }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Soup",
          description: "Simmer it.",
        }),
      );
    }) as typeof fetch,
  });

  await adapter.acquire(videoId, new AbortController().signal);
  assert.equal(pollCount, 2);
  assert.deepEqual(events, ["started", "started", 1, 1]);
});

void test("YouTube preserves a known transcript charge when metadata later fails", async () => {
  const { events, observer } = spendLog();
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    spendObserver: observer,
    diagnostics: silentDiagnostics,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.pathname === "/v1/transcript"
          ? Response.json({
              content: "Simmer it.",
              lang: "en",
              availableLangs: ["en"],
            })
          : Response.json({ error: "provider-failed" }, { status: 500 }),
      );
    }) as typeof fetch,
  });

  await assert.rejects(
    adapter.acquire("partial-youtube", new AbortController().signal),
  );
  assert.deepEqual(events, ["started", "started", 1]);
});

void test("Instagram preserves a known metadata charge when its transcript later fails", async () => {
  const { events, observer } = spendLog();
  const mediaId = "partial-instagram";
  const adapter = createSupadataInstagramAdapter({
    apiKey: "test-key",
    spendObserver: observer,
    diagnostics: silentDiagnostics,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      return Promise.resolve(
        url.pathname === "/v1/metadata"
          ? Response.json({
              platform: "instagram",
              type: "video",
              id: mediaId,
              description: "Simmer it.",
            })
          : Response.json({ error: "provider-failed" }, { status: 500 }),
      );
    }) as typeof fetch,
  });

  await adapter.acquire(
    `https://www.instagram.com/reel/${mediaId}/`,
    mediaId,
    new AbortController().signal,
  );
  assert.deepEqual(events, ["started", 1, "started"]);
});
