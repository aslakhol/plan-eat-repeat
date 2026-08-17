import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPublicationDate,
  publicSlugForDinner,
  toPublishedDinner,
} from "./published-dinner";

void test("Published Dinner projection exposes cooking content without Household activity", () => {
  const published = toPublishedDinner({
    id: 42,
    householdId: "private-household-id",
    name: "Friday curry",
    link: "https://example.com/curry",
    notes: "Double the ginger",
    servings: 4,
    favourite: true,
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
    updatedAt: new Date("2026-08-17T18:30:00.000Z"),
    publicSlug: "friday-curry-public1",
    publishedAt: new Date("2026-08-17T23:30:00.000Z"),
    Household: { name: "The Hendersons" },
    tags: [{ value: "Quick" }, { value: "Comfort" }],
    parts: [
      {
        id: 7,
        dinnerId: 42,
        name: "Curry",
        order: 0,
        ingredients: [
          {
            id: 8,
            partId: 7,
            order: 0,
            name: "ginger",
            amount: 2,
            unit: "tbsp",
            note: "grated",
          },
        ],
        steps: [
          {
            id: 9,
            partId: 7,
            order: 0,
            text: "Fry until fragrant.",
          },
        ],
      },
    ],
  });

  assert.deepEqual(published, {
    publicSlug: "friday-curry-public1",
    publishedAt: "2026-08-17T23:30:00.000Z",
    householdName: "The Hendersons",
    name: "Friday curry",
    tags: ["Quick", "Comfort"],
    link: "https://example.com/curry",
    notes: "Double the ginger",
    servings: 4,
    parts: [
      {
        name: "Curry",
        ingredients: [
          {
            name: "ginger",
            amount: 2,
            unit: "tbsp",
            note: "grated",
          },
        ],
        steps: ["Fry until fragrant."],
      },
    ],
  });

  const serialized = JSON.stringify(published);
  assert.equal(serialized.includes("private-household-id"), false);
  assert.equal(serialized.includes("favourite"), false);
  assert.equal(serialized.includes("createdAt"), false);
  assert.equal(serialized.includes("updatedAt"), false);
  assert.equal(serialized.includes('"id"'), false);
});

void test("public Dinner slugs keep a readable initial name and opaque identity", () => {
  assert.equal(
    publicSlugForDinner("  Crème brûlée & berries  ", "9fK2_xYz"),
    "creme-brulee-berries-9fK2_xYz",
  );
  assert.equal(publicSlugForDinner("寿司", "9fK2_xYz"), "dinner-9fK2_xYz");
});

void test("Publication Date uses a stable English UTC calendar date", () => {
  assert.equal(
    formatPublicationDate("2026-08-17T23:30:00.000-07:00"),
    "18 August",
  );
});
