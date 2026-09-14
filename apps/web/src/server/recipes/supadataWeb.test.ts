import { ImportRecipeError } from "@planeatrepeat/shared";
import assert from "node:assert/strict";
import { test } from "node:test";

import { createSupadataWebAdapter } from "./supadataWeb";

void test("Supadata web scrape returns validated Markdown", async () => {
  const requests: Array<{ headers: Headers; url: URL }> = [];
  const markdown = "# Lentil soup\n\n- 300 g lentils";
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request, init?: RequestInit) => {
      requests.push({
        headers: new Headers(init?.headers),
        url: requestUrl(input),
      });
      return Promise.resolve(
        Response.json(
          {
            url: "https://example.com/lentil-soup",
            content: markdown,
            countCharacters: markdown.length,
            urls: ["https://example.com/about"],
          },
          { headers: { "x-billable-requests": "1" } },
        ),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  const content = await adapter.scrape(
    "https://example.com/lentil-soup?portion=4",
    new AbortController().signal,
  );

  assert.equal(content, markdown);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url.pathname, "/v1/web/scrape");
  assert.equal(
    requests[0]?.url.searchParams.get("url"),
    "https://example.com/lentil-soup?portion=4",
  );
  assert.equal(requests[0]?.headers.get("x-api-key"), "test-key");
});

void test("Supadata web scrape rejects a response over one MiB", async () => {
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.resolve(
        Response.json(
          {
            url: "https://example.com/oversized",
            content: "x",
            countCharacters: 1,
            urls: [],
          },
          { headers: { "content-length": "1048577" } },
        ),
      )) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  await assert.rejects(
    adapter.scrape(
      "https://example.com/oversized",
      new AbortController().signal,
    ),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
});

void test("Supadata web scrape reports a missing API key without a request", async () => {
  let fetchCalls = 0;
  const adapter = createSupadataWebAdapter({
    fetch: (() => {
      fetchCalls += 1;
      return Promise.reject(new Error("fetch should not run"));
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  await assert.rejects(
    adapter.scrape("https://example.com/recipe", new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.equal(fetchCalls, 0);
});

for (const [status, providerCode] of [
  [429, "limit-exceeded"],
  [500, "internal-error"],
] as const) {
  void test(`Supadata web scrape maps HTTP ${status} without leaking the response`, async () => {
    const warnings: Array<Record<string, unknown>> = [];
    const adapter = createSupadataWebAdapter({
      apiKey: "secret-that-must-not-be-logged",
      fetch: (() =>
        Promise.resolve(
          Response.json(
            {
              error: providerCode,
              message: "sensitive provider response text",
              details: { request: "must not be logged" },
            },
            {
              status,
              headers: { "x-billable-requests": "1" },
            },
          ),
        )) as typeof fetch,
      diagnostics: {
        info: () => undefined,
        warn: (_message, fields) => warnings.push(fields),
      },
    });

    await assert.rejects(
      adapter.scrape(
        "https://example.com/private-recipe?token=secret",
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof ImportRecipeError &&
        error.code ===
          (status === 429 ? "IMPORT_LIMIT_REACHED" : "FETCH_FAILED"),
    );
    const serialized = JSON.stringify(warnings);
    assert.doesNotMatch(
      serialized,
      /private-recipe|token|response text|secret/,
    );
  });
}

void test("Supadata web scrape maps transport failures without logging their message", async () => {
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.reject(
        new Error("transport included sensitive text"),
      )) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.scrape("https://example.com/recipe", new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.doesNotMatch(
    JSON.stringify(warnings),
    /transport included sensitive text/,
  );
});

for (const invalidResponse of [
  {
    name: "malformed JSON",
    response: () => new Response("{not-json", { status: 200 }),
  },
  {
    name: "a malformed success schema",
    response: () =>
      Response.json({
        url: "https://example.com/recipe",
        content: ["not", "markdown"],
        countCharacters: 12,
        urls: [],
      }),
  },
  {
    name: "empty Markdown",
    response: () =>
      Response.json({
        url: "https://example.com/recipe",
        content: "  \n ",
        countCharacters: 4,
        urls: [],
      }),
  },
] as const) {
  void test(`Supadata web scrape rejects ${invalidResponse.name}`, async () => {
    const adapter = createSupadataWebAdapter({
      apiKey: "test-key",
      fetch: (() =>
        Promise.resolve(invalidResponse.response())) as typeof fetch,
      diagnostics: {
        info: () => undefined,
        warn: () => undefined,
      },
    });

    await assert.rejects(
      adapter.scrape(
        "https://example.com/recipe",
        new AbortController().signal,
      ),
      (error: unknown) =>
        error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
    );
  });
}

void test("Supadata web scrape stops reading a streamed response over one MiB", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1_048_577));
      controller.close();
    },
  });
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.resolve(new Response(stream, { status: 200 }))) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  await assert.rejects(
    adapter.scrape("https://example.com/recipe", new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
});

void test("caller cancellation stops a Supadata web scrape", async () => {
  const controller = new AbortController();
  const cancellation = new Error("caller cancelled");
  const adapter = createSupadataWebAdapter({
    apiKey: "test-key",
    fetch: ((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(abortReason(init.signal)),
          { once: true },
        );
      })) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: () => undefined,
    },
  });

  const scraping = adapter.scrape(
    "https://example.com/recipe",
    controller.signal,
  );
  controller.abort(cancellation);

  await assert.rejects(scraping, (error: unknown) => error === cancellation);
});

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

const abortReason = (signal?: AbortSignal | null) =>
  signal?.reason instanceof Error
    ? signal.reason
    : new DOMException("The operation was aborted", "AbortError");
