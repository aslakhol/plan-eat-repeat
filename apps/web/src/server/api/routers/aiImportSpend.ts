import { z } from "zod";

import {
  AI_IMPORT_SPEND_PERIOD_KEYS,
  AI_IMPORT_SPEND_PERIOD_LABELS,
} from "~/lib/ai-import-spend";
import { createTRPCRouter, systemAdminProcedure } from "~/server/api/trpc";

export const AI_IMPORT_SPEND_BILLING_LINKS = {
  anthropic: "https://console.anthropic.com/settings/billing",
  supadata: "https://dash.supadata.ai/billing",
} as const;

const dashboardInput = z.object({
  period: z.enum(AI_IMPORT_SPEND_PERIOD_KEYS),
  chartOffset: z.number().int().nonnegative(),
});

export const aiImportSpendRouter = createTRPCRouter({
  dashboard: systemAdminProcedure
    .input(dashboardInput)
    .query(async ({ ctx, input }) => {
      const textAttempts = await ctx.db.aiImportAttempt.aggregate({
        where: { source: "TEXT" },
        _count: { _all: true },
        _sum: { estimatedAiImportCostUsd: true },
        _min: { startedAt: true },
      });

      return {
        environment: ctx.deploymentEnvironment,
        billingLinks: AI_IMPORT_SPEND_BILLING_LINKS,
        collectionStartedOn: textAttempts._min.startedAt,
        textAttemptSummary: {
          attempts: textAttempts._count._all,
          estimatedAiImportCostUsd:
            textAttempts._sum.estimatedAiImportCostUsd ?? 0,
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
          key: input.period,
          label: AI_IMPORT_SPEND_PERIOD_LABELS[input.period],
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
      };
    }),
});
