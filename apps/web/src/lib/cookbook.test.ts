import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDinnerTagGroups,
  deriveDinnerPickerCollection,
  deriveDinnerCollection,
  filterDinnerSummaries,
  formatDinnerSummaryLabel,
  orderDinnerSummaries,
} from "./cookbook";

const summary = (
  id: number,
  name: string,
  overrides: Partial<{
    favourite: boolean;
    cookingFrequency: number;
    lastCookedDate: Date | null;
  }> = {},
) => ({
  id,
  name,
  favourite: false,
  cookingFrequency: 0,
  lastCookedDate: null,
  ...overrides,
});

void test("A–Z ordering uses Dinner ID as a deterministic tie-breaker", () => {
  const dinners = [
    summary(3, "Tacos"),
    summary(2, "Curry"),
    summary(1, "Curry"),
  ];

  assert.deepEqual(
    orderDinnerSummaries(dinners, "az").map((dinner) => dinner.id),
    [1, 2, 3],
  );
});

void test("Haven't had lately orders never-made Dinners before oldest cooked Dinners", () => {
  const dinners = [
    summary(1, "Recent", { lastCookedDate: new Date("2026-08-01T00:00:00Z") }),
    summary(2, "Never B"),
    summary(3, "Old B", { lastCookedDate: new Date("2026-01-01T00:00:00Z") }),
    summary(4, "Old A", { lastCookedDate: new Date("2026-01-01T00:00:00Z") }),
    summary(5, "Never A"),
  ];

  assert.deepEqual(
    orderDinnerSummaries(dinners, "not-lately").map((dinner) => dinner.id),
    [5, 2, 4, 3, 1],
  );
});

void test("Favourites ordering keeps every Dinner and ranks each group by frequency then A–Z", () => {
  const dinners = [
    summary(1, "Bravo", { favourite: false, cookingFrequency: 3 }),
    summary(2, "Alpha", { favourite: false, cookingFrequency: 3 }),
    summary(3, "Delta", { favourite: true, cookingFrequency: 1 }),
    summary(4, "Charlie", { favourite: true, cookingFrequency: 5 }),
  ];

  assert.deepEqual(
    orderDinnerSummaries(dinners, "favourites").map((dinner) => dinner.id),
    [4, 3, 2, 1],
  );
});

void test("Cookbook filtering normalises search text and requires every selected tag", () => {
  const dinners = [
    {
      id: 1,
      name: "Bean Chilli",
      tags: [{ value: "Quick" }, { value: "Vegan" }],
    },
    { id: 2, name: "Sunday roast", tags: [{ value: "Weekend" }] },
    { id: 3, name: "Miso soup", tags: [{ value: "QUICK" }] },
  ];

  assert.deepEqual(
    filterDinnerSummaries(dinners, "  quick ", ["Quick"]).map(
      (dinner) => dinner.id,
    ),
    [1],
  );
  assert.deepEqual(
    filterDinnerSummaries(dinners, "ROAST", []).map((dinner) => dinner.id),
    [2],
  );
  assert.deepEqual(
    filterDinnerSummaries(dinners, "", ["Quick", "Vegan"]).map(
      (dinner) => dinner.id,
    ),
    [1],
  );
});

void test("Cookbook search normalises accents and whitespace in Dinner names and tags", () => {
  const dinners = [
    { id: 1, name: "Crème   brûlée", tags: [{ value: "Dinner party" }] },
    { id: 2, name: "Tomato soup", tags: [{ value: "Quick   lunch" }] },
  ];

  assert.deepEqual(
    filterDinnerSummaries(dinners, "creme brulee", []).map(
      (dinner) => dinner.id,
    ),
    [1],
  );
  assert.deepEqual(
    filterDinnerSummaries(dinners, "quick lunch", []).map(
      (dinner) => dinner.id,
    ),
    [2],
  );
});

void test("tag groups count active Dinners, keep the overall top eight, and never duplicate Selected tags", () => {
  const dinners = [
    {
      name: "A",
      tags: [
        { value: "Quick" },
        { value: "Asian" },
        { value: "Comfort" },
        { value: "Pasta" },
        { value: "Chicken" },
        { value: "Healthy" },
        { value: "Italian" },
        { value: "Beef" },
        { value: "Oven" },
        { value: "Soup" },
      ],
    },
    {
      name: "B",
      tags: [
        { value: "Quick" },
        { value: "Asian" },
        { value: "Comfort" },
        { value: "Pasta" },
        { value: "Chicken" },
        { value: "Healthy" },
        { value: "Italian" },
        { value: "Beef" },
      ],
    },
    {
      name: "C",
      tags: [
        { value: "Quick" },
        { value: "Asian" },
        { value: "Comfort" },
        { value: "Pasta" },
        { value: "Chicken" },
        { value: "Healthy" },
        { value: "Italian" },
      ],
    },
  ];

  const groups = buildDinnerTagGroups(dinners, ["Quick"]);

  assert.deepEqual(groups.selected, [{ value: "Quick", count: 3 }]);
  assert.deepEqual(
    groups.mostUsed.map((tag) => tag.value),
    ["Asian", "Chicken", "Comfort", "Healthy", "Italian", "Pasta", "Beef"],
  );
  assert.deepEqual(groups.all, [
    { value: "Oven", count: 1 },
    { value: "Soup", count: 1 },
  ]);
});

void test("the shared collection seam derives ordering, counts, and contextual empty state", () => {
  const dinners = [
    {
      ...summary(1, "Bean Chilli", { cookingFrequency: 2 }),
      tags: [{ value: "Quick" }, { value: "Vegan" }],
    },
    {
      ...summary(2, "Miso Soup", { cookingFrequency: 4 }),
      tags: [{ value: "Quick" }],
    },
  ];

  const filtered = deriveDinnerCollection(dinners, {
    search: "bean",
    selectedTags: ["Quick"],
    sort: "favourites",
  });
  assert.deepEqual(
    filtered.dinners.map((dinner) => dinner.id),
    [1],
  );
  assert.deepEqual(
    {
      mostPlannedStartIndex: filtered.mostPlannedStartIndex,
      totalCount: filtered.totalCount,
      matchingCount: filtered.matchingCount,
      hasActiveFilters: filtered.hasActiveFilters,
      emptyState: filtered.emptyState,
    },
    {
      mostPlannedStartIndex: null,
      totalCount: 2,
      matchingCount: 1,
      hasActiveFilters: true,
      emptyState: null,
    },
  );

  const noMatches = deriveDinnerCollection(dinners, {
    search: "",
    selectedTags: ["Vegan", "Quick", "Weekend"],
    sort: "az",
  });
  assert.equal(noMatches.emptyState, "no-matches");

  const emptyCookbook = deriveDinnerCollection([], {
    search: "anything",
    selectedTags: [],
    sort: "az",
  });
  assert.equal(emptyCookbook.emptyState, "empty-cookbook");
});

void test("Favourites seam appears only between two visible groups", () => {
  const dinners = [
    {
      ...summary(1, "Favourite B", {
        favourite: true,
        cookingFrequency: 2,
      }),
      tags: [{ value: "Quick" }],
    },
    {
      ...summary(2, "Favourite A", {
        favourite: true,
        cookingFrequency: 2,
      }),
      tags: [{ value: "Weekend" }],
    },
    {
      ...summary(3, "Other B", { cookingFrequency: 3 }),
      tags: [{ value: "Quick" }],
    },
    {
      ...summary(4, "Other A", { cookingFrequency: 3 }),
      tags: [{ value: "Weekend" }],
    },
  ];

  const mixed = deriveDinnerCollection(dinners, {
    search: "",
    selectedTags: [],
    sort: "favourites",
  });
  assert.deepEqual(
    mixed.dinners.map((dinner) => dinner.id),
    [2, 1, 4, 3],
  );
  assert.equal(mixed.mostPlannedStartIndex, 2);

  const favouritesOnly = deriveDinnerCollection(dinners, {
    search: "favourite",
    selectedTags: [],
    sort: "favourites",
  });
  assert.equal(favouritesOnly.mostPlannedStartIndex, null);

  const othersOnly = deriveDinnerCollection(dinners, {
    search: "other",
    selectedTags: [],
    sort: "favourites",
  });
  assert.equal(othersOnly.mostPlannedStartIndex, null);

  const otherSort = deriveDinnerCollection(dinners, {
    search: "",
    selectedTags: [],
    sort: "az",
  });
  assert.equal(otherSort.mostPlannedStartIndex, null);
});

void test("the Week picker excludes the assigned Dinner before filtering and counting", () => {
  const dinners = [
    {
      ...summary(1, "Bean Chilli"),
      tags: [{ value: "Quick" }, { value: "Vegan" }],
    },
    {
      ...summary(2, "Miso Soup"),
      tags: [{ value: "Quick" }],
    },
  ];

  const picker = deriveDinnerPickerCollection(dinners, {
    excludedDinnerId: 1,
    search: "quick",
    selectedTags: [],
    sort: "not-lately",
  });

  assert.deepEqual(
    picker.dinners.map((dinner) => dinner.id),
    [2],
  );
  assert.equal(picker.totalCount, 1);
  assert.equal(picker.matchingCount, 1);
  assert.deepEqual(
    picker.availableDinners.map((dinner) => dinner.id),
    [2],
  );

  const fullCookbookTags = buildDinnerTagGroups(dinners, []);
  assert.deepEqual(fullCookbookTags.mostUsed, [
    { value: "Quick", count: 2 },
    { value: "Vegan", count: 1 },
  ]);
});

void test("summary label prioritises tonight, then nearest upcoming, then most recent past weekday", () => {
  const today = new Date(2026, 7, 12);
  const monday = new Date(2026, 7, 10);
  const thursday = new Date(2026, 7, 13);
  const friday = new Date(2026, 7, 14);
  const tuesday = new Date(2026, 7, 11);

  assert.equal(
    formatDinnerSummaryLabel({
      today,
      lastCookedDate: tuesday,
      currentWeekPlanDates: [friday, today, thursday],
    }),
    "tonight",
  );
  assert.equal(
    formatDinnerSummaryLabel({
      today,
      lastCookedDate: tuesday,
      currentWeekPlanDates: [friday, thursday],
    }),
    "Thursday",
  );
  assert.equal(
    formatDinnerSummaryLabel({
      today,
      lastCookedDate: tuesday,
      currentWeekPlanDates: [monday, tuesday],
    }),
    "Tuesday",
  );
});

void test("summary label formats ISO-week recency through 52 weeks, then over a year", () => {
  const today = new Date(2026, 7, 12);
  const labelFor = (lastCookedDate: Date | null) =>
    formatDinnerSummaryLabel({
      today,
      lastCookedDate,
      currentWeekPlanDates: [],
    });

  assert.equal(labelFor(null), "never made");
  assert.equal(labelFor(new Date(2026, 7, 10)), "this week");
  assert.equal(labelFor(new Date(2026, 7, 3)), "1 wk ago");
  assert.equal(labelFor(new Date(2025, 7, 13)), "52 wks ago");
  assert.equal(labelFor(new Date(2025, 7, 4)), "over a year ago");
});
