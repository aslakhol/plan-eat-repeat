import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { MockLanguageModelV3 } from "ai/test";

process.env.ANTHROPIC_API_KEY = "test-key";
process.env.AI_EXTRACT_MODEL = "test-model";
process.env.SKIP_ENV_VALIDATION = "1";

const ai = await import("ai");
let generateOptions: Parameters<typeof ai.generateText>[0] | undefined;
let modelOutput: unknown = {
  isRecipe: true,
  name: "Soup",
  recipe: { servings: null, parts: [] },
};
const model = new MockLanguageModelV3({
  doGenerate: () =>
    Promise.resolve({
      content: [{ type: "text", text: JSON.stringify(modelOutput) }],
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: {
        inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 20, text: 20, reasoning: 0 },
      },
      warnings: [],
    }),
});
mock.module("@ai-sdk/anthropic", {
  namedExports: { anthropic: () => model },
});
mock.module("ai", {
  namedExports: {
    ...ai,
    generateText: (options: Parameters<typeof ai.generateText>[0]) => {
      generateOptions = options;
      return ai.generateText(options);
    },
  },
});

const { extractRecipe } = await import("./extractRecipe");

void test("recipe extraction keeps two provider retries", async () => {
  await extractRecipe({ parts: [{ type: "text", text: "Soup recipe" }] });

  assert.equal(generateOptions?.maxRetries, 2);
});

void test("default extraction preserves source units and requests standard spellings without measurement conversion", async () => {
  await extractRecipe({
    parts: [{ type: "text", text: "1 cheek of mango, diced" }],
  });
  const system = generateOptions?.system;
  assert.ok(typeof system === "string");
  assert.match(system, /Keep other unit wording in unit, or null if missing/);
  assert.match(
    system,
    /Keep source measurements; normalise equivalent spellings/,
  );
  assert.match(system, /Do not invent quantities/);
});

void test("the shared extraction schema preserves custom units, normalises aliases, and keeps numeric quantities", async () => {
  const validIngredients = [
    { name: "mango", amount: 1, unit: " cheek ", note: "diced" },
    { name: "beef", amount: 0.5, unit: " KILOGRAMS ", note: null },
    { name: "coriander", amount: null, unit: "Large Handfuls", note: null },
    { name: "salt", amount: null, unit: null, note: "to taste" },
    { name: "lime", amount: 2, unit: null, note: null },
    { name: "lime", amount: 2, unit: "stk", note: null },
    { name: "flour", amount: 1, unit: "cups", note: null },
  ];
  const response = {
    isRecipe: true,
    name: "Mango dinner",
    recipe: {
      servings: 2,
      parts: [{ name: null, ingredients: validIngredients, steps: [] }],
    },
  };
  const previous = modelOutput;
  try {
    modelOutput = response;
    const draft = await extractRecipe({
      parts: [{ type: "text", text: "Mango dinner" }],
    });
    assert.deepEqual(draft.recipe.parts[0]?.ingredients, [
      { name: "mango", amount: 1, unit: "cheek", note: "diced" },
      { name: "beef", amount: 0.5, unit: "kg", note: null },
      { name: "coriander", amount: null, unit: "Large Handfuls", note: null },
      { name: "salt", amount: null, unit: null, note: "to taste" },
      { name: "lime", amount: 2, unit: null, note: null },
      { name: "lime", amount: 2, unit: "pcs", note: null },
      { name: "flour", amount: 1, unit: "cup", note: null },
    ]);
    for (const invalid of [
      { amount: "2 × 400 g tins" },
      { amount: "1" },
      { amount: 0 },
      { amount: -1 },
      { name: "" },
      { name: null },
    ]) {
      modelOutput = {
        ...response,
        recipe: {
          ...response.recipe,
          parts: [
            {
              name: null,
              ingredients: [{ ...validIngredients[0], ...invalid }],
              steps: [],
            },
          ],
        },
      };
      await assert.rejects(
        extractRecipe({
          parts: [{ type: "text", text: "Invalid recipe output" }],
        }),
        { name: "AI_NoObjectGeneratedError" },
      );
    }
  } finally {
    modelOutput = previous;
  }
});

void test("an edited Import Prompt can request unit preservation, translations, conversions, and adaptations", async () => {
  const instructions =
    "Preserve source units except convert cups to grams using your estimate. Translate to Norwegian and substitute beans for meat.";
  await extractRecipe({
    parts: [{ type: "text", text: "Soup recipe" }],
    instructions,
  });
  const system = generateOptions?.system;
  assert.ok(typeof system === "string");
  assert.ok(system.endsWith(instructions));
  assert.ok(!system.includes("Keep source measurements"));
  assert.ok(!system.includes("Do not invent quantities"));
});
