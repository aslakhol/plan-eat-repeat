import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPublicationDate,
  publicSlugForDinner,
  type PublishedDinner,
  publishedDinnerPath,
  publishedDinnerRecipeJsonLd,
  publishedDinnerSaveIntentPath,
  publishedDinnerUrl,
  serializePublishedDinnerRecipeJsonLd,
  toPublishedDinner,
  withoutPublishedDinnerSaveIntent,
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
    Household: {
      name: "The Hendersons",
      publicSlug: "the-hendersons-household1",
    },
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
    householdPublicSlug: "the-hendersons-household1",
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
  assert.equal(publishedDinnerPath("soup-public1"), "/d/soup-public1");
  assert.equal(
    publishedDinnerSaveIntentPath("soup-public1"),
    "/d/soup-public1?save=1",
  );
  assert.deepEqual(
    withoutPublishedDinnerSaveIntent({
      publicSlug: "soup-public1",
      save: "1",
      campaign: "summer",
    }),
    { publicSlug: "soup-public1", campaign: "summer" },
  );
  assert.equal(
    publishedDinnerUrl("soup-public1", "https://plan.example/base"),
    "https://plan.example/d/soup-public1",
  );
});

void test("Publication Date uses a stable English UTC calendar date", () => {
  assert.equal(
    formatPublicationDate("2026-08-17T23:30:00.000-07:00"),
    "18 August",
  );
});

void test("Recipe JSON-LD is omitted without ingredients or a non-empty method step", () => {
  const dinner = {
    publicSlug: "toast-night-public1",
    publishedAt: "2026-08-17T12:00:00.000Z",
    householdName: "The Cooks",
    householdPublicSlug: "the-cooks-household1",
    name: "Toast night",
    tags: [],
    link: null,
    notes: null,
    servings: null,
    parts: [{ name: null, ingredients: [], steps: ["", "   "] }],
  } satisfies PublishedDinner;

  assert.equal(publishedDinnerRecipeJsonLd(dinner), null);
});

void test("Recipe JSON-LD contains the available Published Dinner recipe fields", () => {
  const dinner = {
    publicSlug: "friday-curry-public1",
    publishedAt: "2026-08-17T12:00:00.000Z",
    householdName: "The Cooks",
    householdPublicSlug: "the-cooks-household1",
    name: "Friday curry",
    tags: ["Comfort", "Quick"],
    link: "https://example.com/original-curry",
    notes: "Double the ginger.",
    servings: 4,
    parts: [
      {
        name: "Curry",
        ingredients: [
          { name: "ginger", amount: 2, unit: "tbsp", note: "grated" },
        ],
        steps: ["Fry until fragrant.", "   "],
      },
    ],
  } satisfies PublishedDinner;

  assert.deepEqual(publishedDinnerRecipeJsonLd(dinner), {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Friday curry",
    author: { "@type": "Organization", name: "The Cooks" },
    datePublished: "2026-08-17T12:00:00.000Z",
    description: "Double the ginger.",
    keywords: "Comfort, Quick",
    recipeYield: "4 servings",
    recipeIngredient: ["2 tbsp ginger, grated"],
    recipeInstructions: [
      {
        "@type": "HowToSection",
        name: "Curry",
        itemListElement: [
          { "@type": "HowToStep", text: "Fry until fragrant." },
        ],
      },
    ],
  });
});

void test("Recipe JSON-LD serialization safely escapes user-authored content", () => {
  const dinner = {
    publicSlug: "dangerous-public1",
    publishedAt: "2026-08-17T12:00:00.000Z",
    householdName: "Cooks & Friends",
    householdPublicSlug: "cooks-friends-household1",
    name: "</script><script>alert('dinner')</script>",
    tags: [],
    link: null,
    notes: null,
    servings: null,
    parts: [
      {
        name: null,
        ingredients: [],
        steps: ["Serve <immediately> & enjoy."],
      },
    ],
  } satisfies PublishedDinner;

  const serialized = serializePublishedDinnerRecipeJsonLd(dinner);

  assert.ok(serialized);
  assert.equal(serialized.includes("<"), false);
  assert.equal(serialized.includes(">"), false);
  assert.equal(serialized.includes("&"), false);
  assert.equal((JSON.parse(serialized) as { name: string }).name, dinner.name);
});
