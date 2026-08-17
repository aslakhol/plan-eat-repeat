import assert from "node:assert/strict";
import test from "node:test";

import { isChickenDinnerTitle, saveDinnerLabel } from "./chicken-dinner";

void test("chicken dinner titles match case-insensitively as a word", () => {
  for (const title of [
    "Chicken Parmesan",
    "spicy CHICKEN",
    "Winner-winner-chicken-dinner",
    "Grandma's chicken's pie",
  ]) {
    assert.equal(isChickenDinnerTitle(title), true, title);
    assert.equal(saveDinnerLabel(title), "Winner, winner, chicken dinner.");
  }
});

void test("titles containing chicken only as part of another word do not match", () => {
  for (const title of [
    "Chickenpox cure",
    "chickens",
    "chicken2",
    "chicken_fried rice",
    "chickené",
    "Roast dinner",
  ]) {
    assert.equal(isChickenDinnerTitle(title), false, title);
    assert.equal(saveDinnerLabel(title), "Save dinner");
  }
});
