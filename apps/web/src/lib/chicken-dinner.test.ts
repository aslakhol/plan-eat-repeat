import assert from "node:assert/strict";
import test from "node:test";

import { isChickenDinner, saveDinnerLabel } from "./chicken-dinner";

void test("chicken dinner titles match English and Norwegian trigger words", () => {
  for (const title of [
    "Chicken Parmesan",
    "spicy CHICKEN",
    "Winner-winner-chicken-dinner",
    "Grandma's chicken's pie",
    "Kylling tikka masala",
    "grillet KYLLING",
  ]) {
    assert.equal(isChickenDinner(title), true, title);
    assert.equal(saveDinnerLabel(title), "Winner, winner, chicken dinner.");
  }
});

void test("titles containing a trigger only as part of another word do not match", () => {
  for (const title of [
    "Chickenpox cure",
    "chickens",
    "chicken2",
    "chicken_fried rice",
    "chickené",
    "kyllinger",
    "kyllingfilet",
    "kylling2",
    "kylling_salad",
    "Roast dinner",
  ]) {
    assert.equal(isChickenDinner(title), false, title);
    assert.equal(saveDinnerLabel(title), "Save dinner");
  }
});

void test("chicken dinner tags trigger the label case-insensitively", () => {
  for (const tag of ["Chicken", "KYLLING", "spicy chicken"]) {
    assert.equal(isChickenDinner("Vegetable soup", ["Quick", tag]), true, tag);
    assert.equal(
      saveDinnerLabel("Vegetable soup", ["Quick", tag]),
      "Winner, winner, chicken dinner.",
      tag,
    );
  }
});

void test("tag trigger words must be whole words", () => {
  for (const tag of ["Chickens", "kyllingfilet", "kylling_gryte"]) {
    assert.equal(isChickenDinner("Vegetable soup", [tag]), false, tag);
    assert.equal(saveDinnerLabel("Vegetable soup", [tag]), "Save dinner", tag);
  }
});
