import assert from "node:assert/strict";
import test from "node:test";
import {
  importNameConflict,
  importSourceLinkConflict,
  normalizeSourceUrl,
} from "./url-import";

void test("typed Dinner names win unless the meaningful imported name differs", () => {
  assert.equal(importNameConflict(undefined, "Source name"), null);
  assert.equal(importNameConflict("  Taco   Night ", "taco night"), null);
  assert.equal(
    importNameConflict("Taco Night", "Sheet-Pan Chicken Tacos"),
    "Sheet-Pan Chicken Tacos",
  );
});

void test("source URLs ignore presentation and common tracking differences", () => {
  assert.equal(
    normalizeSourceUrl(
      "https://WWW.Example.com/recipes/tacos/?utm_source=newsletter#steps",
    ),
    normalizeSourceUrl("http://example.com/recipes/tacos?gclid=campaign"),
  );
  assert.equal(
    importSourceLinkConflict(
      "https://example.com/recipes/tacos/",
      "https://www.example.com/recipes/tacos#ingredients",
    ),
    null,
  );
});

void test("source URLs retain differences that identify another source", () => {
  assert.notEqual(
    normalizeSourceUrl("https://example.com/recipes/tacos?version=1"),
    normalizeSourceUrl("https://example.com/recipes/tacos?version=2"),
  );
  assert.equal(
    importSourceLinkConflict(
      "https://example.com/recipes/tacos",
      "https://example.com/recipes/burritos",
    ),
    "https://example.com/recipes/burritos",
  );
});

void test("a blank Link accepts an imported URL without a conflict", () => {
  assert.equal(
    importSourceLinkConflict("", "https://example.com/recipes/tacos"),
    null,
  );
  assert.equal(
    importSourceLinkConflict("https://example.com/tacos", null),
    null,
  );
});
