import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DashboardProjection } from "./ai-import-spend";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

mock.module("@clerk/nextjs/server", {
  namedExports: {
    getAuth: () => ({ userId: null }),
  },
});

const { Dashboard, DASHBOARD_QUERY_OPTIONS } =
  await import("./ai-import-spend");

const emptyProjection = {
  environment: "Development" as const,
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
    sources: [],
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
    key: "7" as const,
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
    unknownInferenceAttempts: 2,
    supadataUnknownOperationCount: 3,
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
};

void test("the dashboard keeps zero figures and explains empty and unknown data", () => {
  const html = renderToStaticMarkup(
    createElement(Dashboard, {
      projection: emptyProjection as DashboardProjection,
      selectedPeriod: "7",
      onPeriodChange: () => undefined,
      onShowOlder: () => undefined,
      onShowNewer: () => undefined,
    }),
  );

  assert.match(html, /\$0\.00/);
  assert.match(html, /0 cr/);
  assert.match(html, /0\/0/);
  assert.equal(
    (html.match(/No import attempts in this period\./g) ?? []).length,
    2,
  );
  assert.match(html, /No AI Import Attempts yet/);
  assert.match(html, /collecting since Not started/);
  assert.match(html, /Inference cost is an estimate/);
  assert.match(html, /Unknown charges add no amount to totals/);
  assert.match(html, /2 inference attempts/);
  assert.match(html, /3 Supadata operations/);
  assert.match(html, /never converted to USD/);
  assert.match(html, /remaining allowance is not shown/);
  assert.doesNotMatch(html, /&gt;/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

void test("the dashboard query refetches on focus without polling", () => {
  assert.deepEqual(DASHBOARD_QUERY_OPTIONS, {
    refetchOnWindowFocus: true,
    refetchInterval: false,
  });
});
