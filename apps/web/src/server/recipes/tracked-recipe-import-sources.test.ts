import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyAiImportSource } from "./tracked-recipe-import";

void test("tracked inputs are classified before recipe acquisition", () => {
  const cases = [
    {
      request: { type: "TEXT" as const, text: "A soup recipe" },
      expected: "TEXT",
    },
    {
      request: {
        type: "PHOTO" as const,
        images: [{ data: "aGVsbG8=", mimeType: "image/jpeg" }],
      },
      expected: "PHOTO",
    },
    {
      request: {
        type: "URL" as const,
        url: "https://www.youtube.com/watch?v=BoFkDmTm2uc",
      },
      expected: "YOUTUBE",
    },
    {
      request: {
        type: "URL" as const,
        url: "https://www.instagram.com/reel/DOybkebkcaw/",
      },
      expected: "INSTAGRAM",
    },
    {
      request: {
        type: "URL" as const,
        url: "https://www.instagram.com/share/reel/BAAabcdefghijklmnopqrstu/",
      },
      expected: "INSTAGRAM",
    },
    {
      request: {
        type: "URL" as const,
        url: "https://example.com/recipes/tomato-soup",
      },
      expected: "LINK",
    },
  ] as const;

  for (const { request, expected } of cases) {
    assert.equal(classifyAiImportSource(request), expected);
  }
});
