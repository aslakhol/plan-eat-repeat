import assert from "node:assert/strict";
import test from "node:test";

import {
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
  const dinners = [summary(3, "Tacos"), summary(2, "Curry"), summary(1, "Curry")];

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
