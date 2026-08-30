import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyAiImportSource } from "./tracked-recipe-import";

void test("tracked inputs are classified before recipe acquisition", () => {
  const cases = [
    {
      input: { type: "TEXT" as const, text: "A soup recipe" },
      expected: "TEXT",
    },
    {
      input: {
        type: "PHOTO" as const,
        images: [{ data: "aGVsbG8=", mimeType: "image/jpeg" }],
      },
      expected: "PHOTO",
    },
    {
      input: {
        type: "URL" as const,
        url: "https://www.youtube.com/watch?v=BoFkDmTm2uc",
      },
      expected: "YOUTUBE",
    },
    {
      input: {
        type: "URL" as const,
        url: "https://www.instagram.com/reel/DOybkebkcaw/",
      },
      expected: "INSTAGRAM",
    },
    {
      input: {
        type: "URL" as const,
        url: "https://www.instagram.com/share/reel/BAAabcdefghijklmnopqrstu/",
      },
      expected: "INSTAGRAM",
    },
    {
      input: {
        type: "URL" as const,
        url: "https://example.com/recipes/tomato-soup",
      },
      expected: "LINK",
    },
  ] as const;

  for (const { input, expected } of cases) {
    assert.equal(classifyAiImportSource(input), expected);
  }
});
