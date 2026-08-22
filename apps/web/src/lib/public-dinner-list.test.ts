import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
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

void test("an inactive Public Dinner List renders the public unavailable experience", () => {
  const html = renderToStaticMarkup(createElement(PublicDinnerListUnavailable));

  assert.match(html, /This page is no longer shared/);
  assert.match(html, /Continue to Plan Eat Repeat/);
  assert.doesNotMatch(html, /0 dinners shared/);
});
