import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { TRPCError } from "@trpc/server";
import type { AiImportInferenceState, AiImportSource } from "@planeatrepeat/db";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () => Promise.reject(new Error("Clerk must not be called")),
    getAuth: () => ({ userId: null }),
  },
});

const { aiImportSpendRouter } = await import("./api/routers/aiImportSpend");
const { parseSystemAdminUserIds } = await import("./system-admin");

type AiImportSpendCaller = ReturnType<typeof aiImportSpendRouter.createCaller>;

const REPORT_NOW = new Date("2026-08-30T12:00:00.000Z");

const createCaller = ({
  userId,
  allowlist = "system-admin",
  environment = "Development",
  attempts = [],
  onReportQuery,
  currentHouseholdCount = 0,
  onHouseholdCount,
}: {
  userId: string | null;
  allowlist?: string | null;
  environment?: "Production" | "Preview" | "Development";
  attempts?: Array<{
    source: AiImportSource;
    startedAt: Date;
    householdAttributionKey: string;
    membershipAttributionKey?: string;
    household?: {
      name: string;
      _count: { Members: number };
    } | null;
    membership?: {
      user: { firstName: string | null; lastName: string | null };
    } | null;
    inferenceState: AiImportInferenceState;
    inferenceStartedAt?: Date | null;
    estimatedAiImportCostUsd: number | null;
    supadataCredits: number;
    supadataOperationsStarted: number;
    supadataUnknownOperationCount: number;
  }>;
  onReportQuery?: (query: unknown) => void;
  currentHouseholdCount?: number;
  onHouseholdCount?: () => void;
}): AiImportSpendCaller =>
  aiImportSpendRouter.createCaller({
    auth: { userId },
    db: {
      aiImportAttempt: {
        findMany: (query: unknown) => {
          onReportQuery?.(query);
          return Promise.resolve(
            attempts.map((attempt) => ({
              membershipAttributionKey: "member-a",
              inferenceStartedAt: null,
              household: {
                name: "Current Household",
                _count: { Members: 1 },
              },
              membership: {
                user: { firstName: "Ada", lastName: null },
              },
              ...attempt,
            })),
          );
        },
      },
      household: {
        count: () => {
          onHouseholdCount?.();
          return Promise.resolve(currentHouseholdCount);
        },
      },
    },
    systemAdminUserIds: parseSystemAdminUserIds(allowlist),
    deploymentEnvironment: environment,
    reportNow: () => REPORT_NOW,
  } as unknown as Parameters<typeof aiImportSpendRouter.createCaller>[0]);

const dashboardInput = { period: "7" as const, chartOffset: 0 };

void test("an allowlisted System Admin without a Household receives the empty spend projection", async () => {
  const projection = await createCaller({
    userId: "system-admin",
    environment: "Production",
  }).dashboard(dashboardInput);

  assert.deepEqual(projection, {
    environment: "Production",
    billingLinks: {
      anthropic: "https://console.anthropic.com/settings/billing",
      supadata: "https://dash.supadata.ai/billing",
    },
    collectionStartedOn: null,
    attemptSummary: {
      attempts: 0,
      estimatedAiImportCostUsd: 0,
      supadataCredits: 0,
      supadataOperationsStarted: 0,
      supadataUnknownOperationCount: 0,
      sources: [
        { source: "TEXT", attempts: 0, estimatedAiImportCostUsd: 0 },
        { source: "PHOTO", attempts: 0, estimatedAiImportCostUsd: 0 },
        { source: "YOUTUBE", attempts: 0, estimatedAiImportCostUsd: 0 },
        { source: "INSTAGRAM", attempts: 0, estimatedAiImportCostUsd: 0 },
        { source: "LINK", attempts: 0, estimatedAiImportCostUsd: 0 },
      ],
    },
    last24Hours: {
      aiImportCostUsd: 0,
      supadataCredits: 0,
      previousAiImportCostUsd: 0,
      previousSupadataCredits: 0,
      meanDailyAiImportCostUsd: 0,
      meanDailySupadataCredits: 0,
      medianDailyAiImportCostUsd: 0,
      medianDailySupadataCredits: 0,
      completedDaysInAverage: 0,
      activeHouseholds: 0,
      attempts: 0,
      attemptsUsingSupadata: 0,
    },
    period: {
      key: "7",
      label: "7 days",
      aiImportCostUsd: 0,
      supadataCredits: 0,
      attempts: 0,
      attemptsUsingSupadata: 0,
      activeHouseholds: 0,
      representedHouseholds: 0,
      pricedAttempts: 0,
      noChargeAttempts: 0,
      pendingInferenceAttempts: 0,
      unknownInferenceAttempts: 0,
      supadataUnknownOperationCount: 0,
      averageAiImportCostUsd: 0,
      averageSupadataCredits: 0,
    },
    dailyWindow: {
      days: [],
      chartOffset: 0,
      maximumChartOffset: 0,
    },
    households: [],
    importSources: ["YOUTUBE", "INSTAGRAM", "LINK", "TEXT", "PHOTO"].map(
      (source) => ({
        source,
        attempts: 0,
        pricedAttempts: 0,
        estimatedAiImportCostUsd: 0,
        unknownInferenceAttempts: 0,
        supadataOperationsStarted: 0,
        supadataCredits: 0,
        supadataUnknownOperationCount: 0,
        averageAiImportCostUsd: 0,
        averageSupadataCredits: 0,
      }),
    ),
  });
});

void test("the report exposes all five recorded Import Sources", async () => {
  const collectionStartedOn = new Date("2026-08-30T03:00:00.000Z");
  const projection = await createCaller({
    userId: "system-admin",
    attempts: [
      {
        source: "PHOTO",
        startedAt: collectionStartedOn,
        householdAttributionKey: "household-a",
        inferenceState: "ESTIMATED",
        estimatedAiImportCostUsd: 0.0023456789,
        supadataCredits: 0,
        supadataOperationsStarted: 0,
        supadataUnknownOperationCount: 0,
      },
      {
        source: "YOUTUBE",
        startedAt: new Date("2026-08-30T04:00:00.000Z"),
        householdAttributionKey: "household-a",
        inferenceState: "ESTIMATED",
        estimatedAiImportCostUsd: 0.004,
        supadataCredits: 0,
        supadataOperationsStarted: 0,
        supadataUnknownOperationCount: 0,
      },
      {
        source: "YOUTUBE",
        startedAt: new Date("2026-08-30T05:00:00.000Z"),
        householdAttributionKey: "household-b",
        inferenceState: "ESTIMATED",
        estimatedAiImportCostUsd: 0.006,
        supadataCredits: 0,
        supadataOperationsStarted: 0,
        supadataUnknownOperationCount: 0,
      },
    ],
  }).dashboard(dashboardInput);

  assert.deepEqual(projection.attemptSummary, {
    attempts: 3,
    estimatedAiImportCostUsd: 0.0123456789,
    supadataCredits: 0,
    supadataOperationsStarted: 0,
    supadataUnknownOperationCount: 0,
    sources: [
      { source: "TEXT", attempts: 0, estimatedAiImportCostUsd: 0 },
      {
        source: "PHOTO",
        attempts: 1,
        estimatedAiImportCostUsd: 0.0023456789,
      },
      {
        source: "YOUTUBE",
        attempts: 2,
        estimatedAiImportCostUsd: 0.01,
      },
      { source: "INSTAGRAM", attempts: 0, estimatedAiImportCostUsd: 0 },
      { source: "LINK", attempts: 0, estimatedAiImportCostUsd: 0 },
    ],
  });
  assert.equal(projection.collectionStartedOn, collectionStartedOn);
});

void test("the report summarizes known Supadata credits and unresolved operations", async () => {
  const projection = await createCaller({
    userId: "system-admin",
    attempts: [
      {
        source: "YOUTUBE",
        startedAt: new Date("2026-08-30T03:00:00.000Z"),
        householdAttributionKey: "household-a",
        inferenceState: "ESTIMATED",
        estimatedAiImportCostUsd: 0.01,
        supadataCredits: 3,
        supadataOperationsStarted: 4,
        supadataUnknownOperationCount: 1,
      },
      {
        source: "LINK",
        startedAt: new Date("2026-08-30T04:00:00.000Z"),
        householdAttributionKey: "household-b",
        inferenceState: "ESTIMATED",
        estimatedAiImportCostUsd: 0.005,
        supadataCredits: 1,
        supadataOperationsStarted: 2,
        supadataUnknownOperationCount: 1,
      },
    ],
  }).dashboard(dashboardInput);

  assert.equal(projection.attemptSummary.supadataCredits, 4);
  assert.equal(projection.attemptSummary.supadataOperationsStarted, 6);
  assert.equal(projection.attemptSummary.supadataUnknownOperationCount, 2);
});

void test("the projection comes from one narrow query bounded by its captured current time", async () => {
  const queries: unknown[] = [];
  let householdCountQueries = 0;
  const projection = await createCaller({
    userId: "system-admin",
    onReportQuery: (query) => queries.push(query),
    onHouseholdCount: () => {
      householdCountQueries += 1;
    },
  }).dashboard(dashboardInput);

  assert.equal(queries.length, 1);
  assert.equal(householdCountQueries, 1);
  assert.deepEqual(Object.keys(projection).sort(), [
    "attemptSummary",
    "billingLinks",
    "collectionStartedOn",
    "dailyWindow",
    "environment",
    "households",
    "importSources",
    "last24Hours",
    "period",
  ]);
  const query = queries[0] as {
    where: { startedAt: { lte: unknown } };
    orderBy: unknown;
    select: unknown;
  };
  assert.equal(query.where.startedAt.lte, REPORT_NOW);
  assert.deepEqual(
    {
      ...query,
      where: { startedAt: { lte: "captured current time" } },
    },
    {
      where: { startedAt: { lte: "captured current time" } },
      orderBy: { startedAt: "asc" },
      select: {
        source: true,
        startedAt: true,
        householdAttributionKey: true,
        membershipAttributionKey: true,
        household: {
          select: {
            name: true,
            _count: { select: { Members: true } },
          },
        },
        membership: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        inferenceState: true,
        inferenceStartedAt: true,
        estimatedAiImportCostUsd: true,
        supadataOperationsStarted: true,
        supadataCredits: true,
        supadataUnknownOperationCount: true,
      },
    },
  );
});

void test("the reporting query returns each deployment environment label", async () => {
  for (const environment of ["Production", "Preview", "Development"] as const) {
    const projection = await createCaller({
      userId: "system-admin",
      environment,
    }).dashboard(dashboardInput);

    assert.equal(projection.environment, environment);
  }
});

void test("a non-allowlisted Household administrator is forbidden", async () => {
  const caller = createCaller({ userId: "household-admin" });

  await assert.rejects(caller.dashboard(dashboardInput), isForbidden);
});

void test("a signed-in ordinary user is forbidden", async () => {
  const caller = createCaller({ userId: "ordinary-user" });

  await assert.rejects(caller.dashboard(dashboardInput), isForbidden);
});

void test("a signed-out reporting request is forbidden", async () => {
  const caller = createCaller({ userId: null });

  await assert.rejects(caller.dashboard(dashboardInput), isForbidden);
});

void test("missing or empty System Admin configuration denies everyone", async () => {
  for (const allowlist of [null, "", "  ,  "]) {
    const caller = createCaller({ userId: "system-admin", allowlist });

    await assert.rejects(caller.dashboard(dashboardInput), isForbidden);
  }
});

const isForbidden = (error: unknown) =>
  error instanceof TRPCError && error.code === "FORBIDDEN";
