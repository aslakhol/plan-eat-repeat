import assert from "node:assert/strict";
import { mock, test } from "node:test";

process.env.ANTHROPIC_API_KEY = "test-key";
process.env.AI_EXTRACT_MODEL = "test-model";
process.env.SKIP_ENV_VALIDATION = "1";

let generateOptions: { maxRetries?: number } | undefined;

mock.module("@ai-sdk/anthropic", {
  namedExports: {
    anthropic: () => ({
      provider: "anthropic.messages",
      modelId: "test-model",
    }),
  },
});

mock.module("ai", {
  namedExports: {
    generateText: (options: { maxRetries?: number }) => {
      generateOptions = options;
      return Promise.resolve({
        output: {
          isRecipe: true,
          name: "Soup",
          recipe: { servings: null, parts: [] },
        },
      });
    },
    Output: { object: () => ({}) },
  },
});

const { extractRecipe } = await import("./extractRecipe");

void test("recipe extraction keeps two provider retries", async () => {
  await extractRecipe({ parts: [{ type: "text", text: "Soup recipe" }] });

  assert.equal(generateOptions?.maxRetries, 2);
});
