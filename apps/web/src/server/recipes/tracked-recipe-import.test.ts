import assert from "node:assert/strict";
import { test } from "node:test";

import type { LanguageModelUsage } from "ai";
import type { AiImportSource } from "@planeatrepeat/db";

import {
  createTrackedRecipeImporter,
  type AiImportAttemptChanges,
  type AiImportTrackingPersistence,
  type InferenceObserver,
  type TrackedRecipeImportRequest,
} from "./tracked-recipe-import";
import type { SupadataSpendObserver } from "./supadata-spend";

const pricedUsage: LanguageModelUsage = {
  inputTokens: 1_000,
  inputTokenDetails: {
    noCacheTokens: 1_000,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokens: 200,
  outputTokenDetails: {
    textTokens: 200,
    reasoningTokens: undefined,
  },
  totalTokens: 1_200,
};

type TestHarnessOptions = {
  execute?: (
    request: TrackedRecipeImportRequest,
    observer: InferenceObserver,
    supadataObserver: SupadataSpendObserver,
  ) => Promise<{ name: string }>;
  failOperations?: ReadonlySet<string>;
  loadInstructions?: () => Promise<string | null>;
};

const testHarness = (options: TestHarnessOptions = {}) => {
  const actions: string[] = [];
  const createdSources: AiImportSource[] = [];
  const executedRequests: TrackedRecipeImportRequest[] = [];
  const updates: AiImportAttemptChanges[] = [];
  const warnings: string[] = [];
  const failOperations = options.failOperations ?? new Set<string>();
  const fail = (operation: string) => {
    if (failOperations.has(operation)) {
      throw new Error(`${operation} persistence failed`);
    }
  };

  const persistence: AiImportTrackingPersistence = {
    findAttribution() {
      actions.push("find-attribution");
      fail("find-attribution");
      return Promise.resolve({
        householdId: "household-1",
        membershipId: 7,
        householdAttributionKey: "household-key",
        membershipAttributionKey: "membership-key",
      });
    },
    createAttempt(input) {
      actions.push("create-attempt");
      fail("create-attempt");
      createdSources.push(input.source);
      assert.equal(input.startedAt.toISOString(), "2026-08-30T08:00:00.000Z");
      assert.equal(input.householdId, "household-1");
      assert.equal(input.membershipId, 7);
      assert.equal(input.householdAttributionKey, "household-key");
      assert.equal(input.membershipAttributionKey, "membership-key");
      return Promise.resolve("attempt-1");
    },
    async loadInstructions() {
      actions.push("load-instructions");
      return options.loadInstructions?.() ?? "Use Norwegian";
    },
    updateAttempt(_attemptId, changes) {
      const operation = changes.finishedAt
        ? "finish-attempt"
        : changes.inferenceStartedAt
          ? "start-inference"
          : "capture-usage";
      actions.push(operation);
      fail(operation);
      updates.push(changes);
      return Promise.resolve();
    },
    startSupadataOperation() {
      actions.push("start-supadata-operation");
      fail("start-supadata-operation");
      return Promise.resolve();
    },
    settleSupadataOperation(_attemptId, credits) {
      actions.push(`settle-supadata-operation:${credits}`);
      fail("settle-supadata-operation");
      return Promise.resolve();
    },
  };

  const executeImport = async (execution: {
    request: TrackedRecipeImportRequest;
    observer: InferenceObserver;
    supadataObserver: SupadataSpendObserver;
  }) => {
    actions.push("extract");
    executedRequests.push(execution.request);
    return (
      options.execute?.(
        execution.request,
        execution.observer,
        execution.supadataObserver,
      ) ?? Promise.resolve({ name: "Soup" })
    );
  };

  let tick = 0;
  const importer = createTrackedRecipeImporter({
    persistence,
    executeImport,
    now: () => new Date(Date.UTC(2026, 7, 30, 8, 0, tick++)),
    warn: (operation) => warnings.push(operation),
  });

  return {
    actions,
    createdSources,
    executedRequests,
    importer,
    updates,
    warnings,
  };
};

const input = {
  request: { type: "TEXT" as const, text: "A soup recipe" },
  householdId: "household-1",
  userId: "user-1",
};

const expandedRequests = [
  {
    name: "Photo",
    request: {
      type: "PHOTO" as const,
      images: [{ data: "aGVsbG8=", mimeType: "image/jpeg" }],
    },
    attemptSource: "PHOTO",
  },
  {
    name: "YouTube",
    request: {
      type: "URL" as const,
      url: "https://www.youtube.com/watch?v=BoFkDmTm2uc",
    },
    attemptSource: "YOUTUBE",
  },
  {
    name: "Instagram",
    request: {
      type: "URL" as const,
      url: "https://www.instagram.com/reel/DOybkebkcaw/",
    },
    attemptSource: "INSTAGRAM",
  },
  {
    name: "Link",
    request: {
      type: "URL" as const,
      url: "https://example.com/recipes/tomato-soup",
    },
    attemptSource: "LINK",
  },
] as const;

const inputFor = (request: TrackedRecipeImportRequest) => ({
  request,
  householdId: "household-1",
  userId: "user-1",
});

void test("a Text import records one priced attempt around provider work", async () => {
  const harness = testHarness({
    execute: async (_request, observer) => {
      await observer.onInferenceStart();
      harness.actions.push("provider-call");
      await observer.onInferenceUsage("claude-opus-4-8", pricedUsage);
      return { name: "Soup" };
    },
  });

  assert.deepEqual(await harness.importer(input), { name: "Soup" });
  assert.deepEqual(harness.actions, [
    "find-attribution",
    "create-attempt",
    "load-instructions",
    "extract",
    "start-inference",
    "provider-call",
    "capture-usage",
    "finish-attempt",
  ]);
  assert.deepEqual(harness.updates, [
    { inferenceStartedAt: new Date("2026-08-30T08:00:01.000Z") },
    {
      inferenceState: "ESTIMATED",
      estimatedAiImportCostUsd: 0.01,
    },
    {
      finishedAt: new Date("2026-08-30T08:00:02.000Z"),
      inferenceState: "ESTIMATED",
      estimatedAiImportCostUsd: 0.01,
    },
  ]);
});

for (const { name, request, attemptSource } of expandedRequests) {
  void test(`a successful ${name} import records one priced attempt`, async () => {
    const harness = testHarness({
      execute: async (_request, observer) => {
        await observer.onInferenceStart();
        await observer.onInferenceUsage("claude-opus-4-8", pricedUsage);
        return { name: "Soup" };
      },
    });

    assert.deepEqual(await harness.importer(inputFor(request)), {
      name: "Soup",
    });
    assert.deepEqual(harness.createdSources, [attemptSource]);
    assert.deepEqual(harness.executedRequests, [request]);
    assert.equal(harness.updates.at(-1)?.inferenceState, "ESTIMATED");
  });

  void test(`${name} acquisition failure finishes before inference as not incurred`, async () => {
    const acquisitionFailure = new Error("acquisition failed");
    const harness = testHarness({
      execute: () => Promise.reject(acquisitionFailure),
    });

    await assert.rejects(
      harness.importer(inputFor(request)),
      (error) => error === acquisitionFailure,
    );
    assert.deepEqual(harness.createdSources, [attemptSource]);
    assert.equal(harness.updates.at(-1)?.inferenceState, "NOT_INCURRED");
  });

  void test(`${name} provider failure after inference starts finishes as unknown`, async () => {
    const providerFailure = new Error("provider disconnected");
    const harness = testHarness({
      execute: async (_request, observer) => {
        await observer.onInferenceStart();
        throw providerFailure;
      },
    });

    await assert.rejects(
      harness.importer(inputFor(request)),
      (error) => error === providerFailure,
    );
    assert.equal(harness.updates.at(-1)?.inferenceState, "UNKNOWN");
  });

  void test(`${name} parsing failure retains captured inference spend`, async () => {
    const parsingFailure = new Error("invalid structured output");
    const harness = testHarness({
      execute: async (_request, observer) => {
        await observer.onInferenceStart();
        await observer.onInferenceUsage("claude-opus-4-8", pricedUsage);
        throw parsingFailure;
      },
    });

    await assert.rejects(
      harness.importer(inputFor(request)),
      (error) => error === parsingFailure,
    );
    assert.equal(harness.updates.at(-1)?.inferenceState, "ESTIMATED");
  });

  void test(`${name} cancellation finishes the attempt and preserves the cancellation`, async () => {
    const cancellation = new DOMException(
      "The operation was aborted",
      "AbortError",
    );
    const harness = testHarness({
      execute: async (_request, observer) => {
        await observer.onInferenceStart();
        throw cancellation;
      },
    });

    await assert.rejects(
      harness.importer(inputFor(request)),
      (error) => error === cancellation,
    );
    assert.ok(harness.updates.at(-1)?.finishedAt);
    assert.equal(harness.updates.at(-1)?.inferenceState, "UNKNOWN");
  });
}

void test("an attempt that fails before inference is finished as not incurred", async () => {
  const failure = new Error("instruction lookup failed");
  const harness = testHarness({
    loadInstructions: () => Promise.reject(failure),
  });

  await assert.rejects(harness.importer(input), (error) => error === failure);
  assert.deepEqual(harness.updates, [
    {
      finishedAt: new Date("2026-08-30T08:00:01.000Z"),
      inferenceState: "NOT_INCURRED",
      estimatedAiImportCostUsd: null,
    },
  ]);
});

void test("provider work without usable usage is finished as unknown", async () => {
  const providerFailure = new Error("provider disconnected");
  const harness = testHarness({
    execute: async (_request, observer) => {
      await observer.onInferenceStart();
      throw providerFailure;
    },
  });

  await assert.rejects(
    harness.importer(input),
    (error) => error === providerFailure,
  );
  assert.deepEqual(harness.updates.at(-1), {
    finishedAt: new Date("2026-08-30T08:00:02.000Z"),
    inferenceState: "UNKNOWN",
    estimatedAiImportCostUsd: null,
  });
});

void test("usage remains estimated when later output parsing fails", async () => {
  const parsingFailure = new Error("invalid structured output");
  const harness = testHarness({
    execute: async (_request, observer) => {
      await observer.onInferenceStart();
      await observer.onInferenceUsage("claude-opus-4-8", pricedUsage);
      throw parsingFailure;
    },
  });

  await assert.rejects(
    harness.importer(input),
    (error) => error === parsingFailure,
  );
  assert.equal(harness.updates.at(-1)?.inferenceState, "ESTIMATED");
});

void test("telemetry persistence failures do not change the import result", async () => {
  for (const failedOperation of [
    "find-attribution",
    "create-attempt",
    "start-inference",
    "capture-usage",
    "finish-attempt",
  ]) {
    const harness = testHarness({
      failOperations: new Set([failedOperation]),
      execute: async (_request, observer) => {
        await observer.onInferenceStart();
        await observer.onInferenceUsage("claude-opus-4-8", pricedUsage);
        return { name: "Soup" };
      },
    });

    assert.deepEqual(await harness.importer(input), { name: "Soup" });
    assert.deepEqual(harness.warnings, [failedOperation]);
  }
});

void test("telemetry persistence failures preserve cancellation", async () => {
  const cancellation = new Error("cancelled");
  const harness = testHarness({
    failOperations: new Set(["start-inference", "finish-attempt"]),
    execute: async (_request, observer) => {
      await observer.onInferenceStart();
      throw cancellation;
    },
  });

  await assert.rejects(
    harness.importer(input),
    (error) => error === cancellation,
  );
  assert.deepEqual(harness.warnings, ["start-inference", "finish-attempt"]);
});

void test("partial Supadata acquisition records each operation before later failure", async () => {
  const acquisitionFailure = new Error("metadata failed");
  const harness = testHarness({
    execute: async (_request, _observer, supadataObserver) => {
      await supadataObserver.onOperationStarted();
      harness.actions.push("transcript-request");
      await supadataObserver.onCreditsKnown(1);
      await supadataObserver.onOperationStarted();
      harness.actions.push("metadata-request");
      throw acquisitionFailure;
    },
  });

  await assert.rejects(
    harness.importer(
      inputFor({
        type: "URL",
        url: "https://www.youtube.com/watch?v=BoFkDmTm2uc",
      }),
    ),
    (error) => error === acquisitionFailure,
  );
  assert.deepEqual(harness.actions, [
    "find-attribution",
    "create-attempt",
    "load-instructions",
    "extract",
    "start-supadata-operation",
    "transcript-request",
    "settle-supadata-operation:1",
    "start-supadata-operation",
    "metadata-request",
    "finish-attempt",
  ]);
});

void test("cancellation leaves an in-flight Supadata operation unknown", async () => {
  const controller = new AbortController();
  const harness = testHarness({
    execute: async (_request, _observer, supadataObserver) => {
      await supadataObserver.onOperationStarted();
      controller.abort();
      throw controller.signal.reason;
    },
  });

  await assert.rejects(
    harness.importer({ ...input, signal: controller.signal }),
    (error) => error === controller.signal.reason,
  );
  assert.equal(
    harness.actions.filter((action) => action === "start-supadata-operation")
      .length,
    1,
  );
  assert.equal(
    harness.actions.some((action) =>
      action.startsWith("settle-supadata-operation"),
    ),
    false,
  );
});

void test("a direct Link import records no Supadata operation", async () => {
  const harness = testHarness();

  await harness.importer(
    inputFor({ type: "URL", url: "https://example.com/recipe" }),
  );

  assert.equal(
    harness.actions.some((action) => action.includes("supadata-operation")),
    false,
  );
});

void test("Supadata telemetry failures do not change import results", async () => {
  for (const failedOperation of [
    "start-supadata-operation",
    "settle-supadata-operation",
  ]) {
    const harness = testHarness({
      failOperations: new Set([failedOperation]),
      execute: async (_request, _observer, supadataObserver) => {
        await supadataObserver.onOperationStarted();
        await supadataObserver.onCreditsKnown(2);
        return { name: "Soup" };
      },
    });

    assert.deepEqual(await harness.importer(input), { name: "Soup" });
    assert.deepEqual(harness.warnings, [failedOperation]);
  }
});
