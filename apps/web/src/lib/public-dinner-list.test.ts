import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  derivePublicDinnerList,
  publicDinnerListPath,
  publicDinnerListUrl,
  publicSlugForHousehold,
} from "./public-dinner-list";
import { PublicDinnerListUnavailable } from "../views/PublicDinnerList/PublicDinnerListUnavailable";
import { PublicDinnerListView } from "../views/PublicDinnerList/PublicDinnerListView";

void test("Public Dinner List URLs keep a readable initial Household name and opaque identity", () => {
  assert.equal(
    publicSlugForHousehold("  Crème brûlée club  ", "9fK2_xYz"),
    "creme-brulee-club-9fK2_xYz",
  );
  assert.equal(
    publicSlugForHousehold("寿司", "9fK2_xYz"),
    "household-9fK2_xYz",
  );
  assert.equal(
    publicDinnerListPath("hendersons-9fK2_xYz"),
    "/h/hendersons-9fK2_xYz",
  );
  assert.equal(
    publicDinnerListUrl("hendersons-9fK2_xYz", "https://plan.example/base"),
    "https://plan.example/h/hendersons-9fK2_xYz",
  );
});

void test("Public Dinner List searches names and tags and requires every selected tag", () => {
  const dinners = [
    {
      name: "Crème brûlée",
      publicSlug: "creme-brulee-one",
      publishedAt: "2026-08-20T12:00:00.000Z",
      saveCount: 2,
      tags: ["Dessert", "French"],
    },
    {
      name: "Friday curry",
      publicSlug: "friday-curry-two",
      publishedAt: "2026-08-21T12:00:00.000Z",
      saveCount: 4,
      tags: ["Quick", "Indian"],
    },
    {
      name: "Quick noodles",
      publicSlug: "quick-noodles-three",
      publishedAt: "2026-08-22T12:00:00.000Z",
      saveCount: 0,
      tags: ["Quick", "Vegetarian"],
    },
  ];

  assert.deepEqual(
    derivePublicDinnerList(dinners, {
      search: "creme",
      selectedTags: [],
      sort: "recent",
    }).dinners.map((dinner) => dinner.name),
    ["Crème brûlée"],
  );
  assert.deepEqual(
    derivePublicDinnerList(dinners, {
      search: "indian",
      selectedTags: ["Quick", "Indian"],
      sort: "recent",
    }).dinners.map((dinner) => dinner.name),
    ["Friday curry"],
  );
  assert.equal(
    derivePublicDinnerList(dinners, {
      search: "soup",
      selectedTags: [],
      sort: "recent",
    }).emptyState,
    "no-matches",
  );
});

void test("Public Dinner List applies all three public sorts with deterministic ties", () => {
  const dinners = [
    {
      name: "Apple stew",
      publicSlug: "apple-stew-b",
      publishedAt: "2026-08-20T12:00:00.000Z",
      saveCount: 2,
      tags: [],
    },
    {
      name: "Apple stew",
      publicSlug: "apple-stew-a",
      publishedAt: "2026-08-20T12:00:00.000Z",
      saveCount: 2,
      tags: [],
    },
    {
      name: "Ziti",
      publicSlug: "ziti-newest",
      publishedAt: "2026-08-22T12:00:00.000Z",
      saveCount: 1,
      tags: [],
    },
  ];
  const slugsFor = (sort: "recent" | "az" | "most-saved") =>
    derivePublicDinnerList(dinners, {
      search: "",
      selectedTags: [],
      sort,
    }).dinners.map((dinner) => dinner.publicSlug);

  assert.deepEqual(slugsFor("recent"), [
    "ziti-newest",
    "apple-stew-a",
    "apple-stew-b",
  ]);
  assert.deepEqual(slugsFor("az"), [
    "apple-stew-a",
    "apple-stew-b",
    "ziti-newest",
  ]);
  assert.deepEqual(slugsFor("most-saved"), [
    "apple-stew-a",
    "apple-stew-b",
    "ziti-newest",
  ]);
});

void test("a Public Dinner List renders Household attribution and Published Dinner links in server markup", () => {
  const html = renderToStaticMarkup(
    createElement(PublicDinnerListView, {
      dinnerList: {
        publicSlug: "hendersons-9fK2_xYz",
        householdName: "Hendersons",
        dinners: [
          {
            name: "Spaghetti Carbonara",
            publicSlug: "spaghetti-carbonara-dinner1",
            publishedAt: "2026-08-12T12:00:00.000Z",
            saveCount: 2,
            tags: ["Quick", "Pasta"],
          },
        ],
      },
    }),
  );

  assert.match(html, /Hendersons/);
  assert.match(html, /1 dinner shared/);
  assert.match(html, /href="\/d\/spaghetti-carbonara-dinner1"/);
  assert.match(html, /Spaghetti Carbonara/);
  assert.match(html, /Quick/);
  assert.match(html, /Pasta/);
});

void test("server markup links every Published Dinner beyond the visible batch", () => {
  const dinners = Array.from({ length: 8 }, (_, index) => ({
    name: `Dinner ${index + 1}`,
    publicSlug: `dinner-${index + 1}`,
    publishedAt: `2026-08-${String(20 - index).padStart(2, "0")}T12:00:00.000Z`,
    saveCount: 0,
    tags: [],
  }));
  const html = renderToStaticMarkup(
    createElement(PublicDinnerListView, {
      dinnerList: {
        publicSlug: "hendersons-9fK2_xYz",
        householdName: "Hendersons",
        dinners,
      },
    }),
  );

  for (const dinner of dinners) {
    assert.match(html, new RegExp(`href="/d/${dinner.publicSlug}"`));
  }
});

void test("an inactive Public Dinner List renders the public unavailable experience", () => {
  const html = renderToStaticMarkup(createElement(PublicDinnerListUnavailable));

  assert.match(html, /This page is no longer shared/);
  assert.match(html, /Continue to Plan Eat Repeat/);
  assert.doesNotMatch(html, /0 dinners shared/);
});
