import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDinnerPlanningWeek,
  formatDinnerPlanningConfirmation,
} from "./dinner-planning";

void test("planning weeks always contain complete Monday–Sunday local dates", () => {
  const week = buildDinnerPlanningWeek(new Date(2026, 7, 12));

  assert.equal(week.label, "Week 33, August 2026");
  assert.deepEqual(
    week.days.map((day) => ({
      dayLabel: day.dayLabel,
      dateTime: day.dateTime,
      fullDate: day.fullDate,
    })),
    [
      {
        dayLabel: "Mon 10th",
        dateTime: "2026-08-10",
        fullDate: "Monday, August 10th, 2026",
      },
      {
        dayLabel: "Tue 11th",
        dateTime: "2026-08-11",
        fullDate: "Tuesday, August 11th, 2026",
      },
      {
        dayLabel: "Wed 12th",
        dateTime: "2026-08-12",
        fullDate: "Wednesday, August 12th, 2026",
      },
      {
        dayLabel: "Thu 13th",
        dateTime: "2026-08-13",
        fullDate: "Thursday, August 13th, 2026",
      },
      {
        dayLabel: "Fri 14th",
        dateTime: "2026-08-14",
        fullDate: "Friday, August 14th, 2026",
      },
      {
        dayLabel: "Sat 15th",
        dateTime: "2026-08-15",
        fullDate: "Saturday, August 15th, 2026",
      },
      {
        dayLabel: "Sun 16th",
        dateTime: "2026-08-16",
        fullDate: "Sunday, August 16th, 2026",
      },
    ],
  );
});

void test("planning week labels use the ISO week and the Monday's month and year", () => {
  const week = buildDinnerPlanningWeek(new Date(2027, 0, 3));

  assert.equal(week.label, "Week 53, December 2026");
  assert.equal(week.days[0]?.dateTime, "2026-12-28");
  assert.equal(week.days[6]?.dateTime, "2027-01-03");
});

void test("planning confirmation includes the Dinner name and full date", () => {
  assert.equal(
    formatDinnerPlanningConfirmation(
      "Spaghetti Carbonara",
      new Date(2026, 7, 13),
    ),
    "Spaghetti Carbonara → Thursday, August 13th, 2026",
  );
});
