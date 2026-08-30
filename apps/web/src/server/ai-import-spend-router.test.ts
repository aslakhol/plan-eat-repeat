import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { TRPCError } from "@trpc/server";

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
}: {
  userId: string | null;
  allowlist?: string | null;
  environment?: "Production" | "Preview" | "Development";
}): AiImportSpendCaller =>
  aiImportSpendRouter.createCaller({
    auth: { userId },
    db: {},
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

void test("the reporting query returns each deployment environment label", async () => {
  for (const environment of [
    "Production",
    "Preview",
    "Development",
  ] as const) {
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
