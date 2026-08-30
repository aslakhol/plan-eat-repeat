import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAiImportSpendReport,
  getAiImportSpendPeriod,
  osloDayStartsAt,
  type AiImportSpendReportAttempt,
} from "./ai-import-spend-report";

const attempt = (
  overrides: Partial<AiImportSpendReportAttempt> &
    Pick<AiImportSpendReportAttempt, "startedAt">,
): AiImportSpendReportAttempt => ({
  source: "TEXT",
  householdAttributionKey: "household-a",
  membershipAttributionKey: "member-a",
  household: {
    name: "Current Household A",
    _count: { Members: 1 },
  },
  membership: {
    user: { firstName: "Ada", lastName: "Lovelace" },
  },
  inferenceState: "ESTIMATED",
  estimatedAiImportCostUsd: 0.1,
  supadataOperationsStarted: 0,
  supadataCredits: 0,
  supadataUnknownOperationCount: 0,
  ...overrides,
});

void test("Oslo calendar-day boundaries follow midnight and daylight-saving changes", () => {
  assert.equal(
    osloDayStartsAt("2026-01-15").toISOString(),
    "2026-01-14T23:00:00.000Z",
  );
  assert.equal(
    osloDayStartsAt("2026-03-30").toISOString(),
    "2026-03-29T22:00:00.000Z",
  );
  assert.equal(
    osloDayStartsAt("2026-10-26").toISOString(),
    "2026-10-25T23:00:00.000Z",
  );
});

void test("calendar periods use Oslo dates including today", () => {
  const now = new Date("2026-03-29T22:30:00.000Z");

  assert.equal(getAiImportSpendPeriod("7", now, null).startDate, "2026-03-24");
  assert.equal(getAiImportSpendPeriod("30", now, null).startDate, "2026-03-01");
  assert.equal(
    getAiImportSpendPeriod("month", now, null).startDate,
    "2026-03-01",
  );
  assert.equal(
    getAiImportSpendPeriod("all", now, new Date("2026-01-12T23:30:00.000Z"))
      .startDate,
    "2026-01-13",
  );
});

void test("the projection separates adjacent rolling 24-hour windows", () => {
  const now = new Date("2026-03-30T12:00:00.000Z");
  const report = buildAiImportSpendReport({
    now,
    period: "7",
    chartOffset: 0,
    currentHouseholdCount: 1,
    attempts: [
      attempt({
        startedAt: new Date("2026-03-29T12:00:00.000Z"),
        estimatedAiImportCostUsd: 1,
      }),
      attempt({
        startedAt: new Date("2026-03-29T11:59:59.999Z"),
        estimatedAiImportCostUsd: 2,
        supadataOperationsStarted: 1,
        supadataCredits: 3,
      }),
      attempt({
        startedAt: new Date("2026-03-28T12:00:00.000Z"),
        estimatedAiImportCostUsd: 4,
      }),
    ],
  });

  assert.deepEqual(report.last24Hours, {
    aiImportCostUsd: 1,
    supadataCredits: 0,
    previousAiImportCostUsd: 6,
    previousSupadataCredits: 3,
    meanDailyAiImportCostUsd: 3.5,
    meanDailySupadataCredits: 1.5,
    medianDailyAiImportCostUsd: 3.5,
    medianDailySupadataCredits: 1.5,
    completedDaysInAverage: 2,
    activeHouseholds: 1,
    attempts: 1,
    attemptsUsingSupadata: 0,
  });
});

void test("daily averages start with collection and include later zero-spend days", () => {
  const report = buildAiImportSpendReport({
    now: new Date("2026-04-04T10:00:00.000Z"),
    period: "7",
    chartOffset: 0,
    currentHouseholdCount: 1,
    attempts: [
      attempt({
        startedAt: new Date("2026-04-01T10:00:00.000Z"),
        estimatedAiImportCostUsd: 6,
        supadataOperationsStarted: 1,
        supadataCredits: 3,
      }),
      attempt({
        startedAt: new Date("2026-04-03T10:00:00.000Z"),
        estimatedAiImportCostUsd: 3,
        supadataOperationsStarted: 1,
        supadataCredits: 6,
      }),
    ],
  });

  assert.equal(report.last24Hours.completedDaysInAverage, 3);
  assert.equal(report.last24Hours.meanDailyAiImportCostUsd, 3);
  assert.equal(report.last24Hours.medianDailyAiImportCostUsd, 3);
  assert.equal(report.last24Hours.meanDailySupadataCredits, 3);
  assert.equal(report.last24Hours.medianDailySupadataCredits, 3);
  assert.deepEqual(
    report.dailyWindow.days.slice(-4).map((day) => ({
      date: day.date,
      attempts: day.attempts,
      aiImportCostUsd: day.aiImportCostUsd,
    })),
    [
      { date: "2026-04-01", attempts: 1, aiImportCostUsd: 6 },
      { date: "2026-04-02", attempts: 0, aiImportCostUsd: 0 },
      { date: "2026-04-03", attempts: 1, aiImportCostUsd: 3 },
      { date: "2026-04-04", attempts: 0, aiImportCostUsd: 0 },
    ],
  );
});

void test("period totals use the chosen denominators and retain unknown counts", () => {
  const report = buildAiImportSpendReport({
    now: new Date("2026-08-30T12:00:00.000Z"),
    period: "7",
    chartOffset: 0,
    currentHouseholdCount: 2,
    attempts: [
      attempt({ startedAt: new Date("2026-08-30T08:00:00.000Z") }),
      attempt({
        startedAt: new Date("2026-08-29T08:00:00.000Z"),
        householdAttributionKey: "household-b",
        inferenceState: "NOT_INCURRED",
        estimatedAiImportCostUsd: null,
        supadataOperationsStarted: 1,
        supadataCredits: 4,
      }),
      attempt({
        startedAt: new Date("2026-08-28T08:00:00.000Z"),
        inferenceState: "UNKNOWN",
        estimatedAiImportCostUsd: null,
        supadataOperationsStarted: 1,
        supadataUnknownOperationCount: 1,
      }),
      attempt({
        startedAt: new Date("2026-08-27T08:00:00.000Z"),
        inferenceState: "PENDING",
        estimatedAiImportCostUsd: null,
      }),
    ],
  });

  assert.deepEqual(report.period, {
    key: "7",
    label: "7 days",
    aiImportCostUsd: 0.1,
    supadataCredits: 4,
    attempts: 4,
    attemptsUsingSupadata: 2,
    activeHouseholds: 2,
    representedHouseholds: 2,
    pricedAttempts: 1,
    noChargeAttempts: 1,
    pendingInferenceAttempts: 1,
    unknownInferenceAttempts: 1,
    supadataUnknownOperationCount: 1,
    averageAiImportCostUsd: 0.1,
    averageSupadataCredits: 1,
  });
});

void test("Import Source summaries reconcile recorded period spend across every source", () => {
  const report = buildAiImportSpendReport({
    now: new Date("2026-08-30T12:00:00.000Z"),
    period: "7",
    chartOffset: 0,
    currentHouseholdCount: 1,
    attempts: [
      attempt({
        source: "TEXT",
        startedAt: new Date("2026-08-30T11:00:00.000Z"),
        estimatedAiImportCostUsd: 0.2,
      }),
      attempt({
        source: "PHOTO",
        startedAt: new Date("2026-08-30T10:00:00.000Z"),
        inferenceState: "UNKNOWN",
        estimatedAiImportCostUsd: null,
      }),
      attempt({
        source: "YOUTUBE",
        startedAt: new Date("2026-08-30T09:00:00.000Z"),
        estimatedAiImportCostUsd: 0.3,
        supadataOperationsStarted: 2,
        supadataCredits: 3,
      }),
      attempt({
        source: "YOUTUBE",
        startedAt: new Date("2026-08-30T08:00:00.000Z"),
        estimatedAiImportCostUsd: 0.5,
        supadataOperationsStarted: 1,
        supadataUnknownOperationCount: 1,
      }),
      attempt({
        source: "INSTAGRAM",
        startedAt: new Date("2026-08-30T07:00:00.000Z"),
        inferenceState: "NOT_INCURRED",
        estimatedAiImportCostUsd: null,
        supadataOperationsStarted: 1,
        supadataCredits: 2,
      }),
      attempt({
        source: "LINK",
        startedAt: new Date("2026-08-30T06:00:00.000Z"),
        estimatedAiImportCostUsd: 0.1,
        supadataOperationsStarted: 1,
        supadataCredits: 0,
        supadataUnknownOperationCount: 1,
      }),
    ],
  });

  assert.deepEqual(report.importSources, [
    {
      source: "YOUTUBE",
      attempts: 2,
      pricedAttempts: 2,
      estimatedAiImportCostUsd: 0.8,
      unknownInferenceAttempts: 0,
      supadataOperationsStarted: 3,
      supadataCredits: 3,
      supadataUnknownOperationCount: 1,
      averageAiImportCostUsd: 0.4,
      averageSupadataCredits: 1.5,
    },
    {
      source: "INSTAGRAM",
      attempts: 1,
      pricedAttempts: 0,
      estimatedAiImportCostUsd: 0,
      unknownInferenceAttempts: 0,
      supadataOperationsStarted: 1,
      supadataCredits: 2,
      supadataUnknownOperationCount: 0,
      averageAiImportCostUsd: 0,
      averageSupadataCredits: 2,
    },
    {
      source: "LINK",
      attempts: 1,
      pricedAttempts: 1,
      estimatedAiImportCostUsd: 0.1,
      unknownInferenceAttempts: 0,
      supadataOperationsStarted: 1,
      supadataCredits: 0,
      supadataUnknownOperationCount: 1,
      averageAiImportCostUsd: 0.1,
      averageSupadataCredits: 0,
    },
    {
      source: "TEXT",
      attempts: 1,
      pricedAttempts: 1,
      estimatedAiImportCostUsd: 0.2,
      unknownInferenceAttempts: 0,
      supadataOperationsStarted: 0,
      supadataCredits: 0,
      supadataUnknownOperationCount: 0,
      averageAiImportCostUsd: 0.2,
      averageSupadataCredits: 0,
    },
    {
      source: "PHOTO",
      attempts: 1,
      pricedAttempts: 0,
      estimatedAiImportCostUsd: 0,
      unknownInferenceAttempts: 1,
      supadataOperationsStarted: 0,
      supadataCredits: 0,
      supadataUnknownOperationCount: 0,
      averageAiImportCostUsd: 0,
      averageSupadataCredits: 0,
    },
  ]);
  assert.equal(
    report.importSources.reduce(
      (total, source) => total + source.estimatedAiImportCostUsd,
      0,
    ),
    report.period.aiImportCostUsd,
  );
  assert.equal(
    report.importSources.reduce(
      (total, source) => total + source.supadataCredits,
      0,
    ),
    report.period.supadataCredits,
  );
});

void test("Household attribution uses live names while retaining unavailable groups and represented members", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const currentHousehold = {
    name: "The Renamed Household",
    _count: { Members: 3 },
  };
  const report = buildAiImportSpendReport({
    now,
    period: "7",
    chartOffset: 0,
    currentHouseholdCount: 3,
    attempts: [
      attempt({
        startedAt: new Date("2026-08-30T10:00:00.000Z"),
        household: currentHousehold,
        membership: {
          user: { firstName: "Ada", lastName: "Lovelace" },
        },
        estimatedAiImportCostUsd: 0.6,
        supadataOperationsStarted: 1,
        supadataCredits: 3,
      }),
      attempt({
        startedAt: new Date("2026-08-29T10:00:00.000Z"),
        household: currentHousehold,
        membership: null,
        membershipAttributionKey: "removed-member",
        estimatedAiImportCostUsd: 0.4,
        supadataOperationsStarted: 1,
        supadataCredits: 1,
      }),
      attempt({
        startedAt: new Date("2026-08-28T10:00:00.000Z"),
        householdAttributionKey: "deleted-household",
        household: null,
        membershipAttributionKey: "deleted-member",
        membership: null,
        estimatedAiImportCostUsd: 0.2,
      }),
      attempt({
        startedAt: new Date("2026-08-01T10:00:00.000Z"),
        household: currentHousehold,
        membershipAttributionKey: "member-outside-period",
        membership: {
          user: { firstName: "Outside", lastName: "Period" },
        },
      }),
    ],
  });

  assert.equal(report.period.activeHouseholds, 2);
  assert.equal(report.period.representedHouseholds, 4);
  assert.deepEqual(
    report.households.toSorted((left, right) =>
      right.key.localeCompare(left.key),
    ),
    [
      {
        key: "household-a",
        name: "The Renamed Household",
        available: true,
        currentMemberCount: 3,
        attempts: 2,
        estimatedAiImportCostUsd: 1,
        supadataCredits: 4,
        members: [
          {
            key: "member-a",
            name: "Ada Lovelace",
            available: true,
            attempts: 1,
            estimatedAiImportCostUsd: 0.6,
            supadataCredits: 3,
          },
          {
            key: "removed-member",
            name: "Member unavailable",
            available: false,
            attempts: 1,
            estimatedAiImportCostUsd: 0.4,
            supadataCredits: 1,
          },
        ],
      },
      {
        key: "deleted-household",
        name: "Household unavailable",
        available: false,
        currentMemberCount: null,
        attempts: 1,
        estimatedAiImportCostUsd: 0.2,
        supadataCredits: 0,
        members: [
          {
            key: "deleted-member",
            name: "Member unavailable",
            available: false,
            attempts: 1,
            estimatedAiImportCostUsd: 0.2,
            supadataCredits: 0,
          },
        ],
      },
    ],
  );
});

void test("All time history pages backward in 30-day steps with at most 60 visible dates", () => {
  const attempts = [
    attempt({ startedAt: new Date("2026-01-01T11:00:00.000Z") }),
  ];
  const now = new Date("2026-04-01T10:00:00.000Z");

  const latest = buildAiImportSpendReport({
    now,
    period: "all",
    chartOffset: 0,
    currentHouseholdCount: 1,
    attempts,
  }).dailyWindow;
  const older = buildAiImportSpendReport({
    now,
    period: "all",
    chartOffset: 1,
    currentHouseholdCount: 1,
    attempts,
  }).dailyWindow;
  const oldest = buildAiImportSpendReport({
    now,
    period: "all",
    chartOffset: 99,
    currentHouseholdCount: 1,
    attempts,
  }).dailyWindow;

  assert.equal(latest.days.length, 60);
  assert.equal(latest.days.at(-1)?.date, "2026-04-01");
  assert.equal(older.days.length, 60);
  assert.equal(older.days.at(-1)?.date, "2026-03-02");
  assert.equal(oldest.chartOffset, 2);
  assert.equal(oldest.maximumChartOffset, 2);
  assert.equal(oldest.days[0]?.date, "2026-01-01");
  assert.equal(oldest.days.at(-1)?.date, "2026-01-31");
});

void test("an empty report keeps zero summaries and has no chart dates", () => {
  const report = buildAiImportSpendReport({
    now: new Date("2026-08-30T12:00:00.000Z"),
    period: "all",
    chartOffset: 4,
    currentHouseholdCount: 0,
    attempts: [],
  });

  assert.equal(report.collectionStartedOn, null);
  assert.equal(report.period.attempts, 0);
  assert.equal(report.last24Hours.completedDaysInAverage, 0);
  assert.deepEqual(report.dailyWindow, {
    days: [],
    chartOffset: 0,
    maximumChartOffset: 0,
  });
});
