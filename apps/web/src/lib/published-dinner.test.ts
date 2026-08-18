import assert from "node:assert/strict";
import test from "node:test";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { type PrismaClient } from "@planeatrepeat/db";

import {
  formatPublicationDate,
  type PublishedDinner,
  publishedDinnerRecipeJsonLd,
  publishedDinnerSaveIntentPath,
  serializePublishedDinnerRecipeJsonLd,
  publishedDinnerPath,
  publishedDinnerUrl,
  publicSlugForDinner,
  toPublishedDinner,
  withoutPublishedDinnerSaveIntent,
} from "./published-dinner";
import {
  publishDinner,
  stopDinnerPublication,
} from "~/server/published-dinner";
import { PublishedDinnerView } from "~/views/PublishedDinner/PublishedDinnerView";

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

const renderPublishedDinner = (
  overrides: Partial<PublishedDinner>,
  saveAction?: ReactNode,
) =>
  renderToStaticMarkup(
    createElement(PublishedDinnerView, {
      upsell: "Test upsell.",
      saveAction,
      dinner: {
        publicSlug: "dinner-public1",
        publishedAt: "2026-08-17T12:00:00.000Z",
        householdName: "The Cooks",
        name: "Dinner",
        tags: [],
        link: null,
        notes: null,
        servings: null,
        parts: [],
        ...overrides,
      },
    }),
  );

void test("Published Dinner places the primary save action on desktop and mobile surfaces", () => {
  const html = renderPublishedDinner(
    { name: "Toast night" },
    createElement("button", null, "Add to my cookbook"),
  );

  assert.equal(html.match(/Add to my cookbook/g)?.length, 4);
});

for (const shape of [
  {
    name: "Name-only Dinner",
    dinner: { name: "Toast night" },
    visible: ["Toast night"],
    absent: ["Ingredients", "Method", ">Notes<"],
  },
  {
    name: "Notes-only Dinner",
    dinner: { name: "Use the leftovers", notes: "Check the freezer first." },
    visible: ["Use the leftovers", "Check the freezer first."],
    absent: ["Ingredients", "Method", ">Notes<"],
  },
  {
    name: "ingredient-only Recipe",
    dinner: {
      name: "Fruit bowl",
      parts: [
        {
          name: null,
          ingredients: [
            { name: "apple", amount: 2, unit: null, note: "sliced" },
          ],
          steps: [],
        },
      ],
    },
    visible: ["Ingredients", "apple", "sliced"],
    absent: ["Method"],
  },
  {
    name: "method-only Recipe",
    dinner: {
      name: "Remembered method",
      parts: [
        {
          name: null,
          ingredients: [],
          steps: ["Toast until golden."],
        },
      ],
    },
    visible: ["Method", "Toast until golden."],
    absent: ["Ingredients"],
  },
  {
    name: "mixed Recipe and notes",
    dinner: {
      name: "Soup",
      tags: ["Comfort"],
      link: "https://example.com/soup",
      notes: "Better the next day.",
      servings: 4,
      parts: [
        {
          name: "Soup",
          ingredients: [{ name: "stock", amount: 1, unit: "l", note: null }],
          steps: ["Simmer gently."],
        },
      ],
    },
    visible: [
      "Comfort",
      "example.com",
      "4 servings",
      "Ingredients",
      "Method",
      ">Notes<",
      "Better the next day.",
    ],
    absent: [],
  },
] satisfies Array<{
  name: string;
  dinner: Partial<PublishedDinner>;
  visible: string[];
  absent: string[];
}>) {
  void test(`public rendering supports ${shape.name}`, () => {
    const html = renderPublishedDinner(shape.dinner);
    for (const value of shape.visible) assert.equal(html.includes(value), true);
    for (const value of shape.absent) assert.equal(html.includes(value), false);
  });
}

void test("publishing cannot cross a Household boundary", async () => {
  let mutationCalled = false;
  const foreignDinner = {
    id: 81,
    name: "Private to another Household",
    publicSlug: null,
    publishedAt: null,
  };
  const transaction = {
    dinner: {
      findUnique: ({ where }: { where: { id: number; householdId: string } }) =>
        Promise.resolve(
          where.id === foreignDinner.id && where.householdId === "household-b"
            ? foreignDinner
            : null,
        ),
    },
    $executeRaw: () => {
      mutationCalled = true;
      return Promise.resolve(1);
    },
  };
  const db = {
    $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) =>
      work(transaction),
  } as unknown as PrismaClient;

  const result = await publishDinner(db, "household-a", foreignDinner.id);

  assert.equal(result, null);
  assert.equal(mutationCalled, false);
});

void test("restarting publication serializes the limit check and keeps the slug", async () => {
  const trace: string[] = [];
  const now = new Date("2026-08-18T09:00:00.000Z");
  const transaction = {
    dinner: {
      findUnique: () =>
        Promise.resolve({
          id: 82,
          name: "A renamed Dinner",
          publicSlug: "original-name-public1",
          publishedAt: null,
        }),
      count: () => {
        trace.push("count");
        return Promise.resolve(0);
      },
      update: () => {
        trace.push("update");
        return Promise.resolve({
          id: 82,
          name: "A renamed Dinner",
          publicSlug: "original-name-public1",
          publishedAt: now,
        });
      },
    },
    $executeRaw: () => {
      trace.push("lock");
      return Promise.resolve(1);
    },
  };
  const db = {
    $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) =>
      work(transaction),
  } as unknown as PrismaClient;

  const result = await publishDinner(db, "household-a", 82, now);

  assert.equal(result?.publicSlug, "original-name-public1");
  assert.equal(result?.publishedAt, now);
  assert.deepEqual(trace, ["lock", "count", "update"]);
});

void test("stopping publication preserves the stable Link identity", async () => {
  const transaction = {
    dinner: {
      updateMany: ({
        where,
        data,
      }: {
        where: {
          id: number;
          householdId: string;
          publishedAt: { not: null };
        };
        data: { publishedAt: null };
      }) => {
        assert.deepEqual(where, {
          id: 82,
          householdId: "household-a",
          publishedAt: { not: null },
        });
        assert.deepEqual(data, { publishedAt: null });
        return Promise.resolve({ count: 1 });
      },
    },
  };
  const db = transaction as unknown as PrismaClient;

  const stopped = await stopDinnerPublication(db, "household-a", 82);

  assert.equal(stopped, true);
});
