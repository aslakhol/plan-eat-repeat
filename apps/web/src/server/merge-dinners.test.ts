import assert from "node:assert/strict";
import test from "node:test";

import { planDinnerMerge } from "./merge-dinners";

const date = (day: number) => new Date(Date.UTC(2026, 7, day));

void test("Dinner Merge preserves one kept Plan Slot for every discarded date", () => {
  const changes = planDinnerMerge({
    keptDinnerId: 10,
    discardedDinnerId: 20,
    planSlots: [
      { id: 9, dinnerId: 30, date: date(1) },
      { id: 8, dinnerId: 20, date: date(4) },
      { id: 7, dinnerId: 10, date: date(4) },
      { id: 6, dinnerId: 10, date: date(4) },
      { id: 5, dinnerId: 10, date: date(3) },
      { id: 4, dinnerId: 10, date: date(3) },
      { id: 3, dinnerId: 20, date: date(2) },
      { id: 2, dinnerId: 20, date: date(2) },
      { id: 1, dinnerId: 20, date: date(1) },
      { id: 0, dinnerId: 10, date: date(1) },
    ],
  });

  assert.deepEqual(changes, {
    reassignPlanSlotIds: [2],
    deletePlanSlotIds: [1, 3, 7, 8],
  });
});
