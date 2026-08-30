import assert from "node:assert/strict";
import { test } from "node:test";

import { estimateAiImportCostUsd } from "./ai-import-inference";

const usage = (
  noCacheTokens: number | undefined,
  outputTokens: number | undefined,
) => ({
  inputTokens: noCacheTokens,
  inputTokenDetails: {
    noCacheTokens,
    cacheReadTokens: undefined,
    cacheWriteTokens: undefined,
  },
  outputTokens,
  outputTokenDetails: {
    textTokens: outputTokens,
    reasoningTokens: undefined,
  },
  totalTokens:
    noCacheTokens === undefined || outputTokens === undefined
      ? undefined
      : noCacheTokens + outputTokens,
});

void test("prices recognized Claude Opus 4.8 usage without rounding", () => {
  assert.equal(
    estimateAiImportCostUsd("claude-opus-4-8", usage(1, 1)),
    0.00003,
  );
});

void test("does not invent a price for an unrecognized model", () => {
  assert.equal(
    estimateAiImportCostUsd("claude-sonnet-4-6", usage(1_000, 500)),
    null,
  );
});

void test("does not treat missing usage as zero", () => {
  assert.equal(
    estimateAiImportCostUsd("claude-opus-4-8", usage(undefined, 500)),
    null,
  );
  assert.equal(
    estimateAiImportCostUsd("claude-opus-4-8", usage(1_000, undefined)),
    null,
  );
});
