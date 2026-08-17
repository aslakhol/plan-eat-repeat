import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesPublishedDinnerSource,
  projectPublishedDinnerCopy,
  reconcilePublishedDinnerTags,
} from "./save-published-dinner";

void test("Published Dinner Tags reuse destination spelling case-insensitively without creating Tags", () => {
  assert.deepEqual(
    reconcilePublishedDinnerTags(
      ["quick", "COMFORT", "Unfamiliar"],
      ["Quick", "comfort", "Weeknight"],
    ),
    ["Quick", "comfort"],
  );
});

void test("ordinary save detection matches either the source Dinner itself or a direct copy", () => {
  assert.equal(
    matchesPublishedDinnerSource({ id: 42, sourceDinnerId: null }, 42),
    true,
  );
  assert.equal(
    matchesPublishedDinnerSource({ id: 84, sourceDinnerId: 42 }, 42),
    true,
  );
  assert.equal(
    matchesPublishedDinnerSource({ id: 84, sourceDinnerId: 24 }, 42),
    false,
  );
});

void test("Published Dinner copies cooking content and technical identity but excludes Household activity and publication state", () => {
  const copy = projectPublishedDinnerCopy(
    {
      id: 42,
      householdId: "source-household",
      name: "Friday curry",
      link: "https://example.com/curry",
      notes: "Double the ginger",
      servings: 4,
      favourite: true,
      createdAt: new Date("2026-08-01T10:00:00.000Z"),
      updatedAt: new Date("2026-08-17T18:30:00.000Z"),
      publicSlug: "friday-curry-public1",
      publishedAt: new Date("2026-08-17T12:00:00.000Z"),
      tags: [{ value: "quick" }, { value: "Unfamiliar" }],
      parts: [
        {
          name: "Curry",
          order: 7,
          ingredients: [
            {
              order: 8,
              name: "ginger",
              amount: 2,
              unit: "tbsp",
              note: "grated",
            },
          ],
          steps: [{ order: 9, text: "Fry until fragrant." }],
        },
      ],
      Plan: [{ id: 1 }],
    },
    "destination-household",
    ["Quick", "Weeknight"],
  );

  assert.deepEqual(copy, {
    name: "Friday curry",
    householdId: "destination-household",
    link: "https://example.com/curry",
    notes: "Double the ginger",
    servings: 4,
    sourceDinnerId: 42,
    tags: { connect: [{ value: "Quick" }] },
    parts: {
      create: [
        {
          name: "Curry",
          order: 0,
          ingredients: {
            create: [
              {
                order: 0,
                name: "ginger",
                amount: 2,
                unit: "tbsp",
                note: "grated",
              },
            ],
          },
          steps: {
            create: [{ order: 0, text: "Fry until fragrant." }],
          },
        },
      ],
    },
  });
  const serialized = JSON.stringify(copy);
  for (const excluded of [
    "favourite",
    "Plan",
    "publicSlug",
    "publishedAt",
    "createdAt",
    "updatedAt",
    "source-household",
  ]) {
    assert.equal(serialized.includes(excluded), false, excluded);
  }
});
