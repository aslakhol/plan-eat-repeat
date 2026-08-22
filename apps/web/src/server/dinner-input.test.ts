import assert from "node:assert/strict";
import test from "node:test";

import { createDinnerInputSchema, editDinnerInputSchema } from "./dinner-input";

void test("the Dinner create boundary normalizes an explicit Link", () => {
  const input = createDinnerInputSchema.parse({
    dinnerName: "Tacos",
    tagList: [],
    link: " https://EXAMPLE.com:443 ",
  });

  assert.equal(input.link, "https://example.com/");
});

void test("the Dinner edit boundary rejects a scheme-less Link", () => {
  assert.throws(
    () =>
      editDinnerInputSchema.parse({
        dinnerId: 1,
        dinnerName: "Tacos",
        tagList: [],
        link: "example.com/recipe",
      }),
    /Enter a valid link/,
  );
});
