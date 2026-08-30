import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { TRPCError } from "@trpc/server";
import type { AiImportSource } from "@planeatrepeat/db";

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

const createCaller = ({
  userId,
  allowlist = "system-admin",
  environment = "Development",
  sourceSummaries = [],
}: {
  userId: string | null;
  allowlist?: string | null;
  environment?: "Production" | "Preview" | "Development";
  sourceSummaries?: Array<{
    source: AiImportSource;
    attempts: number;
    estimatedAiImportCostUsd: number | null;
    supadataCredits?: number | null;
    supadataOperationsStarted?: number | null;
    supadataUnknownOperationCount?: number | null;
    collectionStartedOn: Date | null;
  }>;
}): AiImportSpendCaller =>
  aiImportSpendRouter.createCaller({
    auth: { userId },
    db: {
      aiImportAttempt: {
        groupBy: () =>
          Promise.resolve(
            sourceSummaries.map((summary) => ({
              source: summary.source,
              _count: { _all: summary.attempts },
              _sum: {
                estimatedAiImportCostUsd: summary.estimatedAiImportCostUsd,
                supadataCredits: summary.supadataCredits ?? 0,
                supadataOperationsStarted:
                  summary.supadataOperationsStarted ?? 0,
                supadataUnknownOperationCount:
                  summary.supadataUnknownOperationCount ?? 0,
              },
              _min: { startedAt: summary.collectionStartedOn },
            })),
          ),
      },
    },
    systemAdminUserIds: parseSystemAdminUserIds(allowlist),
    deploymentEnvironment: environment,
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
      averageAiImportCostUsd: 0,
      averageSupadataCredits: 0,
    },
    dailyWindow: {
      days: [],
      chartOffset: 0,
      maximumChartOffset: 0,
    },
    households: [],
    importSources: [],
  });
});

void test("the report exposes all five recorded Import Sources", async () => {
  const collectionStartedOn = new Date("2026-08-30T08:00:00.000Z");
  const projection = await createCaller({
    userId: "system-admin",
    sourceSummaries: [
      {
        source: "YOUTUBE",
        attempts: 2,
        estimatedAiImportCostUsd: 0.01,
        collectionStartedOn: new Date("2026-08-30T09:00:00.000Z"),
      },
      {
        source: "PHOTO",
        attempts: 1,
        estimatedAiImportCostUsd: 0.0023456789,
        collectionStartedOn,
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
    sourceSummaries: [
      {
        source: "YOUTUBE",
        attempts: 2,
        estimatedAiImportCostUsd: 0.01,
        supadataCredits: 3,
        supadataOperationsStarted: 4,
        supadataUnknownOperationCount: 1,
        collectionStartedOn: new Date("2026-08-30T08:00:00.000Z"),
      },
      {
        source: "LINK",
        attempts: 2,
        estimatedAiImportCostUsd: 0.005,
        supadataCredits: 1,
        supadataOperationsStarted: 2,
        supadataUnknownOperationCount: 1,
        collectionStartedOn: new Date("2026-08-30T09:00:00.000Z"),
      },
    ],
  }).dashboard(dashboardInput);

  assert.equal(projection.attemptSummary.supadataCredits, 4);
  assert.equal(projection.attemptSummary.supadataOperationsStarted, 6);
  assert.equal(projection.attemptSummary.supadataUnknownOperationCount, 2);
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
