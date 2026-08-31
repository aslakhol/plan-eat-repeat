import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportRecipeError } from "@planeatrepeat/shared";

import { createSupadataYouTubeAdapter } from "./supadata";

const requestUrl = (input: string | URL | Request) =>
  new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );

void test("Supadata acquires native YouTube captions and metadata", async () => {
  const videoId = "BoFkDmTm2uc";
  const requests: Array<{ headers: Headers; url: URL }> = [];
  const billableResponses: unknown[] = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      requests.push({ headers: new Headers(init?.headers), url });

      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json(
            {
              content: "Whisk the cream into the flour.",
              lang: "en",
              availableLangs: ["en", "nb"],
            },
            { headers: { "x-billable-requests": "1" } },
          ),
        );
      }

      if (url.pathname === "/v1/metadata") {
        return Promise.resolve(
          Response.json(
            {
              platform: "youtube",
              type: "video",
              id: videoId,
              title: "Biscuits and gravy",
              description: "1 cup flour\n1 cup cream",
            },
            { headers: { "x-billable-requests": "1" } },
          ),
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url.href}`));
    }) as typeof fetch,
    diagnostics: {
      info: (_message, fields) => billableResponses.push(fields),
      warn: () => undefined,
    },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.deepEqual(evidence, {
    title: "Biscuits and gravy",
    description: "1 cup flour\n1 cup cream",
    transcript: "Whisk the cream into the flour.",
    transcriptLanguage: "en",
  });
  assert.equal(requests.length, 2);

  const transcriptRequest = requests.find(
    ({ url }) => url.pathname === "/v1/transcript",
  );
  assert.equal(transcriptRequest?.url.searchParams.get("mode"), "native");
  assert.equal(transcriptRequest?.url.searchParams.get("text"), "true");
  assert.equal(transcriptRequest?.url.searchParams.has("lang"), false);
  assert.equal(
    transcriptRequest?.url.searchParams.get("url"),
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  assert.equal(transcriptRequest?.headers.get("x-api-key"), "test-key");

  const metadataRequest = requests.find(
    ({ url }) => url.pathname === "/v1/metadata",
  );
  assert.equal(
    metadataRequest?.url.searchParams.get("url"),
    `https://www.youtube.com/watch?v=${videoId}`,
  );
  assert.equal(metadataRequest?.headers.get("x-api-key"), "test-key");
  assert.deepEqual(billableResponses, [
    { operation: "transcript", status: 200, billableRequests: "1" },
    { operation: "metadata", status: 200, billableRequests: "1" },
  ]);
});

void test("Supadata starts YouTube transcript and metadata requests concurrently", async () => {
  const videoId = "BoFkDmTm2uc";
  const requestPaths: string[] = [];
  let releaseRequests: (() => void) | undefined;
  const requestsReleased = new Promise<void>((resolve) => {
    releaseRequests = resolve;
  });
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: (async (input: string | URL | Request) => {
      const url = requestUrl(input);
      requestPaths.push(url.pathname);
      await requestsReleased;
      if (url.pathname === "/v1/transcript") {
        return Response.json({
          content: "Transcript",
          lang: "en",
          availableLangs: ["en"],
        });
      }
      return Response.json({
        platform: "youtube",
        type: "video",
        id: videoId,
        title: "Title",
        description: "Description",
      });
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const acquisition = adapter.acquire(videoId, new AbortController().signal);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(requestPaths, ["/v1/transcript", "/v1/metadata"]);

  releaseRequests?.();
  await acquisition;
  assert.deepEqual(requestPaths, ["/v1/transcript", "/v1/metadata"]);
});

void test("Supadata observes concurrent YouTube response failures", async () => {
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: (() =>
      Promise.resolve(
        Response.json({ error: "provider-unavailable" }, { status: 503 }),
      )) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  await assert.rejects(
    adapter.acquire("BoFkDmTm2uc", new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
});

void test("Supadata returns metadata when native captions are unavailable", async () => {
  const videoId = "YdFjuglEAds";
  const requestedModes: string[] = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);

      if (url.pathname === "/v1/transcript") {
        requestedModes.push(url.searchParams.get("mode") ?? "");
        return Promise.resolve(
          Response.json(
            {
              error: "transcript-unavailable",
              message: "No transcript found",
              details: null,
            },
            { status: 206, headers: { "x-billable-requests": "1" } },
          ),
        );
      }

      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Crispy potatoes",
          description: "Boil the potatoes, then roast until crisp.",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.deepEqual(evidence, {
    title: "Crispy potatoes",
    description: "Boil the potatoes, then roast until crisp.",
    transcript: "",
    transcriptLanguage: null,
  });
  assert.deepEqual(requestedModes, ["native"]);
});

void test("Supadata reports a missing API key without making a request", async () => {
  let fetchCalls = 0;
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    fetch: (() => {
      fetchCalls += 1;
      return Promise.reject(new Error("fetch should not run"));
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire("nHDNtxvrhHc", new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.equal(fetchCalls, 0);
  assert.deepEqual(warnings, [
    {
      videoId: "nHDNtxvrhHc",
      category: "configuration",
    },
  ]);
});

const providerFailures = [
  [400, "invalid-request"],
  [401, "unauthorized"],
  [402, "upgrade-required"],
  [403, "forbidden"],
  [404, "not-found"],
  [429, "limit-exceeded"],
  [500, "internal-error"],
] as const;

for (const [status, providerCode] of providerFailures) {
  void test(`Supadata maps HTTP ${status} to a sanitized acquisition failure`, async () => {
    const videoId = "BoFkDmTm2uc";
    const warnings: Array<Record<string, unknown>> = [];
    const adapter = createSupadataYouTubeAdapter({
      apiKey: "secret-that-must-not-be-logged",
      fetch: ((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.pathname === "/v1/transcript") {
          return Promise.resolve(
            Response.json(
              {
                error: providerCode,
                message: `Provider body for ${providerCode}`,
                details: { secret: "must not be logged" },
              },
              { status },
            ),
          );
        }
        return Promise.resolve(
          Response.json({
            platform: "youtube",
            type: "video",
            id: videoId,
            title: "Title",
            description: "Description",
          }),
        );
      }) as typeof fetch,
      diagnostics: {
        info: () => undefined,
        warn: (_message, fields) => warnings.push(fields),
      },
    });

    await assert.rejects(
      adapter.acquire(videoId, new AbortController().signal),
      (error: unknown) =>
        error instanceof ImportRecipeError &&
        error.code ===
          (status === 429 ? "IMPORT_LIMIT_REACHED" : "FETCH_FAILED"),
    );
    assert.deepEqual(warnings, [
      {
        videoId,
        category: "provider",
        operation: "transcript",
        status,
        providerCode,
        billableRequests: null,
      },
    ]);
  });
}

void test("Supadata maps a metadata request limit to IMPORT_LIMIT_REACHED", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({
            content: "Transcript",
            lang: "en",
            availableLangs: ["en"],
          }),
        );
      }
      return Promise.resolve(
        Response.json(
          {
            error: "limit-exceeded",
            message: "Request rate or credit quota exceeded",
          },
          { status: 429 },
        ),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError &&
      error.code === "IMPORT_LIMIT_REACHED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "provider",
      operation: "metadata",
      status: 429,
      providerCode: "limit-exceeded",
      billableRequests: null,
    },
  ]);
});

void test("Supadata polls a native transcript job to completion", async () => {
  const videoId = "nHDNtxvrhHc";
  const jobResponses = [
    { status: "queued" },
    { status: "active" },
    {
      status: "completed",
      content: "Mix the garlic into the butter.",
      lang: "nb",
      availableLangs: ["nb"],
    },
  ];
  let jobPolls = 0;
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 0,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "job-1" }, { status: 202 }),
        );
      }
      if (url.pathname === "/v1/transcript/job-1") {
        const body = jobResponses[jobPolls];
        jobPolls += 1;
        return Promise.resolve(Response.json(body));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Garlic butter",
          description: null,
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.equal(jobPolls, 3);
  assert.deepEqual(evidence, {
    title: "Garlic butter",
    description: "",
    transcript: "Mix the garlic into the butter.",
    transcriptLanguage: "nb",
  });
});

void test("Supadata rejects an oversized response before parsing it", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              content: "Transcript",
              lang: "en",
              availableLangs: ["en"],
            }),
            { headers: { "content-length": "1048577" } },
          ),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "response-too-large",
      operation: "transcript",
      status: 200,
      billableRequests: null,
    },
  ]);
});

void test("Supadata rejects metadata for a different YouTube video", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({
            content: "Transcript",
            lang: "zh-TW",
            availableLangs: ["zh-TW"],
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: "YdFjuglEAds",
          title: "Wrong video",
          description: "Wrong evidence",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "invalid-response",
      operation: "metadata",
      status: 200,
      billableRequests: null,
    },
  ]);
});

void test("Supadata maps transport errors without logging their message", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.reject(new Error("upstream included sensitive text"));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "transport",
      operation: "transcript",
    },
  ]);
});

void test("Supadata reports a malformed transcript at the provider seam", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ content: ["not", "text"], lang: "en" }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "invalid-response",
      operation: "transcript",
      status: 200,
      billableRequests: null,
    },
  ]);
});

void test("Supadata accepts the SDK's nested completed-job result", async () => {
  const videoId = "BoFkDmTm2uc";
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 0,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "nested-job" }, { status: 202 }),
        );
      }
      if (url.pathname === "/v1/transcript/nested-job") {
        return Promise.resolve(
          Response.json({
            status: "completed",
            result: {
              content: "Nested transcript",
              lang: "zh-TW",
              availableLangs: ["zh-TW"],
            },
          }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: null,
          description: "Written recipe",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.equal(evidence.transcript, "Nested transcript");
  assert.equal(evidence.transcriptLanguage, "zh-TW");
  assert.equal(evidence.title, "");
});

void test("Supadata maps a failed transcript job to FETCH_FAILED", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 0,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "failed-job" }, { status: 202 }),
        );
      }
      if (url.pathname === "/v1/transcript/failed-job") {
        return Promise.resolve(Response.json({ status: "failed" }));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "job-failed",
      operation: "transcript-job",
      status: 200,
      providerCode: "job-failed",
      billableRequests: null,
    },
  ]);
});

void test("Supadata stops transcript polling when the caller cancels", async () => {
  const videoId = "BoFkDmTm2uc";
  const cancellation = new Error("request cancelled");
  const controller = new AbortController();
  const warnings: Array<Record<string, unknown>> = [];
  let jobPolls = 0;
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 10_000,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "cancelled-job" }, { status: 202 }),
        );
      }
      if (url.pathname === "/v1/transcript/cancelled-job") {
        jobPolls += 1;
        return Promise.resolve(Response.json({ status: "active" }));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  const result = adapter.acquire(videoId, controller.signal);
  setImmediate(() => controller.abort(cancellation));

  await assert.rejects(result, (error: unknown) => error === cancellation);
  assert.equal(jobPolls, 0);
  assert.deepEqual(warnings, []);
});

void test("Supadata stops transcript polling when its deadline expires", async () => {
  const videoId = "BoFkDmTm2uc";
  const deadline = AbortSignal.timeout(5);
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    pollIntervalMs: 10_000,
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json({ jobId: "timed-out-job" }, { status: 202 }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  await assert.rejects(
    adapter.acquire(videoId, deadline),
    (error: unknown) =>
      error instanceof DOMException && error.name === "TimeoutError",
  );
});

void test("Supadata treats an empty native transcript as unavailable", async () => {
  const videoId = "YdFjuglEAds";
  const requestedModes: string[] = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        requestedModes.push(url.searchParams.get("mode") ?? "");
        return Promise.resolve(
          Response.json({ content: "", lang: "en", availableLangs: ["en"] }),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Recipe",
          description: "Use the written recipe.",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.equal(evidence.transcript, "");
  assert.deepEqual(requestedModes, ["native"]);
});

for (const invalidMetadata of [
  { platform: "vimeo", type: "video" },
  { platform: "youtube", type: "short" },
] as const) {
  void test(`Supadata rejects ${invalidMetadata.platform}/${invalidMetadata.type} metadata`, async () => {
    const videoId = "BoFkDmTm2uc";
    const warnings: Array<Record<string, unknown>> = [];
    const adapter = createSupadataYouTubeAdapter({
      apiKey: "test-key",
      fetch: ((input: string | URL | Request) => {
        const url = requestUrl(input);
        if (url.pathname === "/v1/transcript") {
          return Promise.resolve(
            Response.json({
              content: "Transcript",
              lang: "en",
              availableLangs: ["en"],
            }),
          );
        }
        return Promise.resolve(
          Response.json({
            ...invalidMetadata,
            id: videoId,
            title: "Wrong source",
            description: "Wrong evidence",
          }),
        );
      }) as typeof fetch,
      diagnostics: {
        info: () => undefined,
        warn: (_message, fields) => warnings.push(fields),
      },
    });

    await assert.rejects(
      adapter.acquire(videoId, new AbortController().signal),
      (error: unknown) =>
        error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
    );
    assert.deepEqual(warnings, [
      {
        videoId,
        category: "invalid-response",
        operation: "metadata",
        status: 200,
        billableRequests: null,
      },
    ]);
  });
}

void test("Supadata maps malformed JSON to a sanitized acquisition failure", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(new Response("{not-json", { status: 200 }));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "invalid-response",
      operation: "transcript",
      status: 200,
      billableRequests: null,
    },
  ]);
});

void test("Supadata accepts a declared response below one MiB", async () => {
  const videoId = "BoFkDmTm2uc";
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(
          Response.json(
            { content: "Transcript", lang: "en", availableLangs: ["en"] },
            { headers: { "content-length": "1020000" } },
          ),
        );
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: { info: () => undefined, warn: () => undefined },
  });

  const evidence = await adapter.acquire(videoId, new AbortController().signal);

  assert.equal(evidence.transcript, "Transcript");
});

void test("Supadata stops reading a streamed response over one MiB", async () => {
  const videoId = "BoFkDmTm2uc";
  const warnings: Array<Record<string, unknown>> = [];
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1_048_577));
      controller.close();
    },
  });
  const adapter = createSupadataYouTubeAdapter({
    apiKey: "test-key",
    fetch: ((input: string | URL | Request) => {
      const url = requestUrl(input);
      if (url.pathname === "/v1/transcript") {
        return Promise.resolve(new Response(stream, { status: 200 }));
      }
      return Promise.resolve(
        Response.json({
          platform: "youtube",
          type: "video",
          id: videoId,
          title: "Title",
          description: "Description",
        }),
      );
    }) as typeof fetch,
    diagnostics: {
      info: () => undefined,
      warn: (_message, fields) => warnings.push(fields),
    },
  });

  await assert.rejects(
    adapter.acquire(videoId, new AbortController().signal),
    (error: unknown) =>
      error instanceof ImportRecipeError && error.code === "FETCH_FAILED",
  );
  assert.deepEqual(warnings, [
    {
      videoId,
      category: "response-too-large",
      operation: "transcript",
      status: 200,
      billableRequests: null,
    },
  ]);
});
