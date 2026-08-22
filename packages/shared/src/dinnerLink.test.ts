import assert from "node:assert/strict";
import test from "node:test";

import { dinnerLinkSchema, normalizeDinnerLinkInput } from "./index";

void test("a domain-only Dinner Link receives an HTTPS scheme", () => {
  assert.equal(
    normalizeDinnerLinkInput("example.com/recipe"),
    "https://example.com/recipe",
  );
});

void test("an explicit HTTP Dinner Link keeps its scheme", () => {
  assert.equal(
    normalizeDinnerLinkInput("http://example.com/recipe"),
    "http://example.com/recipe",
  );
});

void test("an explicit Dinner Link is trimmed and canonicalized", () => {
  assert.equal(
    normalizeDinnerLinkInput(" https://EXAMPLE.com:443 "),
    "https://example.com/",
  );
});

void test("an unsupported Dinner Link scheme is rejected", () => {
  assert.equal(normalizeDinnerLinkInput("mailto:cook@example.com"), null);
});

void test("the server Dinner Link schema normalizes an explicit URL", () => {
  assert.equal(
    dinnerLinkSchema.parse(" https://EXAMPLE.com:443 "),
    "https://example.com/",
  );
});

void test("a domain-only Dinner Link can include a port, query, and fragment", () => {
  assert.equal(
    normalizeDinnerLinkInput("recipes.example.com:8443/tacos?size=4#steps"),
    "https://recipes.example.com:8443/tacos?size=4#steps",
  );
});

void test("blank Dinner Link inputs represent no Link", () => {
  assert.deepEqual(
    ["", "   ", null, undefined].map((value) => dinnerLinkSchema.parse(value)),
    [null, null, null, undefined],
  );
});

void test("the editor rejects values that are not everyday web links", () => {
  assert.deepEqual(
    [
      "not a link",
      "/recipes/1",
      "//example.com/recipe",
      "kitchen",
      "cook@example.com",
      "192.168.1.20/menu",
      "ftp://example.com/recipe",
      "javascript:alert(1)",
    ].map(normalizeDinnerLinkInput),
    [null, null, null, null, null, null, null, null],
  );
});

void test("the server rejects scheme-less Dinner Links", () => {
  assert.throws(
    () => dinnerLinkSchema.parse("example.com/recipe"),
    /Enter a valid link/,
  );
});
