import assert from "node:assert/strict";
import test from "node:test";
import { validUrlOrNull } from "@planeatrepeat/shared";
import {
  importErrorCopy,
  importNameConflict,
  importPhases,
  urlImportErrorCopy,
  urlImportPhases,
} from "./url-import";

void test("URL imports accept HTTP(S) pages regardless of entry label", () => {
  assert.equal(
    validUrlOrNull(" https://example.com/recipe "),
    "https://example.com/recipe",
  );
  assert.equal(
    validUrlOrNull("https://youtu.be/dQw4w9WgXcQ"),
    "https://youtu.be/dQw4w9WgXcQ",
  );
  assert.equal(validUrlOrNull("mailto:cook@example.com"), null);
  assert.equal(validUrlOrNull("not a URL"), null);
});

void test("typed Dinner names win unless the meaningful imported name differs", () => {
  assert.equal(importNameConflict(undefined, "Source name"), null);
  assert.equal(importNameConflict("  Taco   Night ", "taco night"), null);
  assert.equal(
    importNameConflict("Taco Night", "Sheet-Pan Chicken Tacos"),
    "Sheet-Pan Chicken Tacos",
  );
});

void test("URL progress follows parsed acquisition instead of the entry label", () => {
  assert.deepEqual(urlImportPhases("https://example.com/recipe"), [
    "Fetching the page",
    "Reading the recipe",
    "Structuring it",
  ]);
  assert.deepEqual(urlImportPhases("https://youtu.be/dQw4w9WgXcQ"), [
    "Fetching the video",
    "Reading the recipe",
    "Structuring it",
  ]);
});

void test("typed import errors use plain source-specific copy", () => {
  assert.deepEqual(
    urlImportErrorCopy("FETCH_FAILED", "https://seriouseats.com/recipe"),
    {
      title: "Couldn't reach the site",
      body: "seriouseats.com didn't answer. It may be down, or your connection dropped.",
    },
  );
  assert.deepEqual(
    urlImportErrorCopy(
      "NO_RECIPE_FOUND",
      "https://youtube.com/watch?v=dQw4w9WgXcQ",
    ),
    {
      title: "Couldn't find a recipe",
      body: "This video doesn't seem to include a readable recipe.",
    },
  );
});

void test("photo and text imports expose source-specific progress", () => {
  assert.deepEqual(importPhases("photos"), [
    "Reading the photos",
    "Reading the recipe",
    "Structuring it",
  ]);
  assert.deepEqual(importPhases("text"), [
    "Reading the recipe",
    "Structuring it",
  ]);
});

void test("photo and text errors promise to retain their submitted input", () => {
  assert.deepEqual(importErrorCopy("NO_RECIPE_FOUND", "photos"), {
    title: "Couldn't find a recipe",
    body: "These photos don't seem to contain a readable recipe. Your selected photos are still here.",
  });
  assert.deepEqual(importErrorCopy("EXTRACTION_FAILED", "text"), {
    title: "Couldn't finish the recipe",
    body: "Something went wrong while structuring it. Your text is still here.",
  });
});
