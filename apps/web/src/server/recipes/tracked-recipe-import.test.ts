import assert from "node:assert/strict";
import { test } from "node:test";

import type { LanguageModelUsage } from "ai";

import {
  createTrackedRecipeImporter,
  type AiImportAttemptChanges,
  type AiImportTrackingPersistence,
  type InferenceObserver,
} from "./tracked-recipe-import";

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
  extract?: (observer: InferenceObserver) => Promise<{ name: string }>;
  failOperations?: ReadonlySet<string>;
  loadInstructions?: () => Promise<string | null>;
};

const testHarness = (options: TestHarnessOptions = {}) => {
  const actions: string[] = [];
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
      assert.deepEqual(input, {
        source: "TEXT",
        startedAt: new Date("2026-08-30T08:00:00.000Z"),
        householdId: "household-1",
        membershipId: 7,
        householdAttributionKey: "household-key",
        membershipAttributionKey: "membership-key",
      });
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
  };

  const extractFromText = async (input: { observer: InferenceObserver }) => {
    actions.push("extract");
    return (
      options.extract?.(input.observer) ?? Promise.resolve({ name: "Soup" })
    );
  };

  let tick = 0;
  const importer = createTrackedRecipeImporter({
    persistence,
    extractFromText,
    now: () => new Date(Date.UTC(2026, 7, 30, 8, 0, tick++)),
    warn: (operation) => warnings.push(operation),
  });

  return { actions, importer, updates, warnings };
};

const input = {
  source: { type: "TEXT" as const, text: "A soup recipe" },
  householdId: "household-1",
  userId: "user-1",
};

void test("a Text import records one priced attempt around provider work", async () => {
  const harness = testHarness({
    extract: async (observer) => {
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
    extract: async (observer) => {
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
    extract: async (observer) => {
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
      extract: async (observer) => {
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
    extract: async (observer) => {
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
