import assert from "node:assert/strict";
import { test } from "node:test";
import {
  selectRecipeIngredient,
  suggestShoppingItems,
} from "./shopping-matching";

const sources = [
  { name: "Cheese", note: null },
  { name: "Blue cheese", note: null },
  { name: "Brown cheese", note: null },
  { name: "Eggs", note: null },
  { name: "Bread", note: null },
  { id: "duck", name: "Eggs", note: "duck" },
] as const;

void test("shopping previews match names, preserve eligible notes, and rank literal choices last", () => {
  for (const [query, expected] of [
    [
      "Cheese",
      [
        ["Cheese", null],
        ["Blue cheese", null],
        ["Brown cheese", null],
      ],
    ],
    [
      "Cheese balls",
      [
        ["Cheese", "balls"],
        ["Blue cheese", "balls"],
        ["Brown cheese", "balls"],
        ["Cheese balls", null],
      ],
    ],
    [
      "Duck egg",
      [
        ["Eggs", "duck"],
        ["Duck egg", null],
      ],
    ],
    [
      "Egg bread",
      [
        ["Bread", "Egg"],
        ["Egg bread", null],
      ],
    ],
    ["Egg ", [["Egg", null]]],
    [
      "Eggs",
      [
        ["Eggs", null],
        ["Eggs", "duck"],
      ],
    ],
    ["Duck", [["Duck", null]]],
    [
      "Eggs organic",
      [
        ["Eggs", "organic"],
        ["Eggs organic", null],
      ],
    ],
    ["  ", []],
  ] as const) {
    assert.deepEqual(
      suggestShoppingItems(query, sources).map(({ name, note }) => [
        name,
        note,
      ]),
      expected,
      query,
    );
  }
});

void test("previews deduplicate normalized destinations and prefer coverage, fewer introduced words, then Own Items", () => {
  const previews = suggestShoppingItems("blue cheese", [
    { name: "Cheese", note: null },
    { name: "Blue cheese", note: null },
    { id: "exact", name: " BLUE  CHEESE ", note: null },
    { name: "Fancy blue cheese", note: null },
    { name: "Cheesecake", note: null },
  ]);
  assert.deepEqual(
    previews.map(({ name, note }) => [name, note]),
    [
      [" BLUE  CHEESE ", null],
      ["Fancy blue cheese", null],
      ["Cheese", "blue"],
      ["Cheesecake", "blue"],
    ],
  );
  assert.deepEqual(previews[0]?.selection, { ownItemId: "exact" });
  assert.deepEqual(
    suggestShoppingItems("duck", [
      { id: "duck-eggs", name: "Duck eggs", note: "fresh" },
    ])[0]?.selection,
    { ownItemId: "duck-eggs" },
  );
});

void test("recipe selection uses complete product words and preserves ambiguous ingredient names", () => {
  const recipeSources = [
    ...sources,
    { name: "Carrots", note: null },
    { id: "grated", name: "Cheese", note: "grated" },
  ] as const;
  for (const [name, expected] of [
    ["Car", { name: "Car", note: null }],
    [
      "Cheese",
      { name: "Cheese", note: null, source: { standardName: "Cheese" } },
    ],
    [
      "Cheese balls",
      { name: "Cheese", note: "balls", source: { standardName: "Cheese" } },
    ],
    [
      "Duck eggs",
      { name: "Eggs", note: "Duck", source: { standardName: "Eggs" } },
    ],
    ["Duck egg", { name: "Duck egg", note: null }],
    [
      "Blue cheese balls",
      {
        name: "Blue cheese",
        note: "balls",
        source: { standardName: "Blue cheese" },
      },
    ],
    ["Cheese bread", { name: "Cheese bread", note: null }],
  ] as const) {
    assert.deepEqual(
      selectRecipeIngredient(name, recipeSources),
      expected,
      name,
    );
    assert.deepEqual(
      selectRecipeIngredient(name, [...recipeSources].reverse()),
      expected,
      name,
    );
  }
});

void test("recipe selection prefers exact Own Items, then exact catalog items, and deduplicates identical interpretations", () => {
  const ownCheese = {
    id: "own-cheese",
    name: "CHEESE",
    note: null,
  } as const;
  const exact = {
    id: "corrected",
    name: " Cheese  balls ",
    note: null,
  } as const;
  assert.deepEqual(
    selectRecipeIngredient("cheese balls", [...sources, exact]),
    { ownItemId: "corrected" },
  );
  assert.deepEqual(selectRecipeIngredient("cheese", [...sources, ownCheese]), {
    ownItemId: "own-cheese",
  });
  assert.deepEqual(
    selectRecipeIngredient("cheese balls", [...sources, ownCheese]),
    {
      name: "CHEESE",
      note: "balls",
      source: { ownItemId: "own-cheese" },
    },
  );
  assert.deepEqual(
    selectRecipeIngredient("Cream cheese", [
      ...sources,
      { name: "Cream cheese", note: null },
      { id: "cream", name: "Cream", note: null },
    ]),
    {
      name: "Cream cheese",
      note: null,
      source: { standardName: "Cream cheese" },
    },
  );
});

void test("new preview names are capitalized while existing destinations keep their spelling", () => {
  assert.equal(suggestShoppingItems("mIXED cASE", [])[0]?.name, "Mixed case");
  const saved = [{ id: "saved", name: "iPhone", note: null }] as const;
  assert.equal(suggestShoppingItems("IPHONE", saved)[0]?.name, "iPhone");
  assert.equal(suggestShoppingItems("IPHONE cover", saved)[0]?.name, "Iphone");
  assert.equal(suggestShoppingItems("2% MILK", [])[0]?.name, "2% Milk");
});
