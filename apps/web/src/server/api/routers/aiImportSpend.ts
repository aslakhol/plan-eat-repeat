import { z } from "zod";

import { createTRPCRouter, systemAdminProcedure } from "~/server/api/trpc";

export const AI_IMPORT_SPEND_BILLING_LINKS = {
  anthropic: "https://console.anthropic.com/settings/billing",
  supadata: "https://dash.supadata.ai/billing",
} as const;

const dashboardInput = z.object({
  period: z.enum(["7", "30", "month", "all"]),
  chartOffset: z.number().int().nonnegative(),
});

const periodLabels = {
  "7": "7 days",
  "30": "30 days",
  month: "This month",
  all: "All time",
} as const;

export const aiImportSpendRouter = createTRPCRouter({
  dashboard: systemAdminProcedure
    .input(dashboardInput)
    .query(({ ctx, input }) => ({
      environment: ctx.deploymentEnvironment,
      billingLinks: AI_IMPORT_SPEND_BILLING_LINKS,
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
        key: input.period,
        label: periodLabels[input.period],
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
        chartOffset: input.chartOffset,
        maximumChartOffset: 0,
      },
      households: [],
      importSources: [],
    })),
});
