import assert from "node:assert/strict";
import { test } from "node:test";
import { suggestShoppingItems } from "./shopping-matching";

const sources = [
  { name: "Cheese", note: null, category: "DAIRY" },
  { name: "Blue cheese", note: null, category: "DAIRY" },
  { name: "Brown cheese", note: null, category: "DAIRY" },
  { name: "Eggs", note: null, category: "DAIRY" },
  { name: "Bread", note: null, category: "BAKERY" },
  { id: "duck", name: "Eggs", note: "duck", category: "MEAT" },
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
    { name: "Cheese", note: null, category: "DAIRY" },
    { name: "Blue cheese", note: null, category: "DAIRY" },
    { id: "exact", name: " BLUE  CHEESE ", note: null, category: "PETS" },
    { name: "Fancy blue cheese", note: null, category: "DAIRY" },
    { name: "Cheesecake", note: null, category: "SNACKS" },
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
      { id: "duck-eggs", name: "Duck eggs", note: "fresh", category: "DAIRY" },
    ])[0]?.selection,
    { ownItemId: "duck-eggs" },
  );
});
