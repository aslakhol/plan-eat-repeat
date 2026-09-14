import { ImportRecipeError } from "@planeatrepeat/shared";
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createTrackedRecipeImporter,
  type AiImportTrackingPersistence,
} from "./tracked-recipe-import";

type Dependencies = Parameters<
  typeof createTrackedRecipeImporter<{ name: string }>
>[0];
const input = {
  request: { type: "TEXT" as const, text: "A soup recipe" },
  householdId: "household-1",
  userId: "user-1",
};
const draft = { name: "Soup" };
const model = {
  providerId: "anthropic.messages",
  requestedModelId: "claude-opus-4-8",
};

function importer(
  overrides: Partial<Dependencies> = {},
  failingOperation?: keyof AiImportTrackingPersistence,
) {
  const persistence: AiImportTrackingPersistence = {
    findAttribution: () =>
      Promise.resolve({
        householdId: input.householdId,
        membershipId: 7,
        householdAttributionKey: "household-key",
        membershipAttributionKey: "membership-key",
      }),
    createAttempt: () => Promise.resolve("attempt-1"),
    loadInstructions: () => Promise.resolve("Use Norwegian"),
    saveInstructions: () => Promise.resolve(),
    updateAttempt: () => Promise.resolve(),
    startSupadataOperation: () => Promise.resolve(),
    settleSupadataOperation: () => Promise.resolve(),
  };
  if (failingOperation) {
    persistence[failingOperation] = () =>
      Promise.reject<never>(new Error("Persistence unavailable"));
  }
  return createTrackedRecipeImporter({
    persistence,
    executeImport: async ({ observer, supadataObserver }) => {
      await supadataObserver.onOperationStarted();
      await supadataObserver.onCreditsKnown(1);
      await observer.onInferenceStart(model);
      await observer.onInferenceUsage({
        ...model,
        responseModelId: model.requestedModelId,
        usage: {
          inputTokens: 10,
          inputTokenDetails: {
            noCacheTokens: 10,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokens: 10,
          outputTokenDetails: { textTokens: 10, reasoningTokens: 0 },
          totalTokens: 20,
        },
      });
      return draft;
    },
    warn: () => undefined,
    ...overrides,
  });
}

void test("telemetry failures cannot prevent a successful import", async () => {
  for (const operation of [
    "findAttribution",
    "createAttempt",
    "updateAttempt",
    "startSupadataOperation",
    "settleSupadataOperation",
  ] as const) {
    assert.deepEqual(await importer({}, operation)(input), draft, operation);
  }
});

void test("failure to remember a prompt still imports with the submitted instructions", async () => {
  const run = importer(
    {
      executeImport: ({ instructions }) => {
        assert.equal(instructions, "My unsaved experiment");
        return Promise.resolve(draft);
      },
    },
    "saveInstructions",
  );
  assert.deepEqual(
    await run({
      ...input,
      prompt: "My unsaved experiment",
      rememberPrompt: true,
    }),
    draft,
  );
});

void test("telemetry failures preserve the original provider error or cancellation", async () => {
  for (const failure of [
    new Error("Provider unavailable"),
    new DOMException("Cancelled", "AbortError"),
  ]) {
    const run = importer(
      {
        executeImport: async ({ observer }) => {
          await observer.onInferenceStart(model);
          throw failure;
        },
      },
      "updateAttempt",
    );
    await assert.rejects(run(input), (error) => error === failure);
  }
});

void test("an attempt deadline aborts provider work even if the caller cancels afterward", async () => {
  const controller = new AbortController();
  const run = importer({
    timeoutMs: 5,
    executeImport: ({ signal }) =>
      new Promise((_resolve, reject) => {
        assert.ok(signal);
        const guard = setTimeout(
          () => reject(new Error("Deadline did not fire")),
          1_000,
        );
        signal.addEventListener(
          "abort",
          () => {
            clearTimeout(guard);
            const reason: unknown = signal.reason;
            controller.abort(new Error("Cancelled after deadline"));
            assert.ok(reason instanceof Error);
            reject(reason);
          },
          { once: true },
        );
      }),
  });
  await assert.rejects(
    run({ ...input, signal: controller.signal }),
    (error) =>
      error instanceof ImportRecipeError && error.code === "IMPORT_TIMED_OUT",
  );
});

void test("caller cancellation wins when provider cleanup finishes after the deadline", async () => {
  const controller = new AbortController();
  const cancellation = new Error("Cancelled by user");
  const run = importer({
    timeoutMs: 5,
    executeImport: ({ signal }) =>
      new Promise((_resolve, reject) => {
        controller.abort(cancellation);
        assert.equal(signal?.reason, cancellation);
        setTimeout(() => reject(cancellation), 10);
      }),
  });
  await assert.rejects(
    run({ ...input, signal: controller.signal }),
    (error) => error === cancellation,
  );
});
