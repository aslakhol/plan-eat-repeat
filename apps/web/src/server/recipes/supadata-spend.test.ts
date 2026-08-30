import assert from "node:assert/strict";
import { test } from "node:test";

import { creditsFromSupadataBillingHeader } from "./supadata-spend";

void test("a valid Supadata billing header establishes the credit amount", () => {
  assert.equal(creditsFromSupadataBillingHeader("0"), 0);
  assert.equal(creditsFromSupadataBillingHeader("12"), 12);
});

void test("missing or malformed Supadata billing headers remain unknown", () => {
  for (const value of [
    null,
    "",
    " 1",
    "1 ",
    "01",
    "-1",
    "1.5",
    "not-a-number",
    "9007199254740992",
  ]) {
    assert.equal(creditsFromSupadataBillingHeader(value), null, String(value));
  }
});
