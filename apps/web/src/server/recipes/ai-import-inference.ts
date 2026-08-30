import type { LanguageModelUsage } from "ai";

const CLAUDE_OPUS_4_8 = "claude-opus-4-8";
const USD_PER_MILLION_UNCACHED_INPUT_TOKENS = 5;
const USD_PER_MILLION_OUTPUT_TOKENS = 25;
const TOKENS_PER_MILLION = 1_000_000;

export const estimateAiImportCostUsd = (
  model: string,
  usage: LanguageModelUsage,
): number | null => {
  if (model !== CLAUDE_OPUS_4_8) return null;

  const inputTokens = usage.inputTokenDetails.noCacheTokens;
  const outputTokens = usage.outputTokens;
  if (inputTokens === undefined || outputTokens === undefined) return null;

  return (
    (inputTokens * USD_PER_MILLION_UNCACHED_INPUT_TOKENS +
      outputTokens * USD_PER_MILLION_OUTPUT_TOKENS) /
    TOKENS_PER_MILLION
  );
};
