import { z } from "zod";
import type { AiImportSource } from "@planeatrepeat/db";

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

const IMPORT_SOURCE_ORDER = [
  "TEXT",
  "PHOTO",
  "YOUTUBE",
  "INSTAGRAM",
  "LINK",
] as const satisfies ReadonlyArray<AiImportSource>;

export const aiImportSpendRouter = createTRPCRouter({
  dashboard: systemAdminProcedure
    .input(dashboardInput)
    .query(async ({ ctx, input }) => {
      const attemptsBySource = await ctx.db.aiImportAttempt.groupBy({
        by: ["source"],
        _count: { _all: true },
        _sum: {
          estimatedAiImportCostUsd: true,
          supadataCredits: true,
          supadataOperationsStarted: true,
          supadataUnknownOperationCount: true,
        },
        _min: { startedAt: true },
      });
      const sourceSummaries = IMPORT_SOURCE_ORDER.map((source) => {
        const attempts = attemptsBySource.find(
          (summary) => summary.source === source,
        );
        return {
          source,
          attempts: attempts?._count._all ?? 0,
          estimatedAiImportCostUsd:
            attempts?._sum.estimatedAiImportCostUsd ?? 0,
        };
      });
      const collectionStartedOn = attemptsBySource.reduce<Date | null>(
        (earliest, summary) => {
          const startedAt = summary._min.startedAt;
          if (!startedAt || (earliest && earliest <= startedAt)) {
            return earliest;
          }
          return startedAt;
        },
        null,
      );

      return {
        environment: ctx.deploymentEnvironment,
        billingLinks: AI_IMPORT_SPEND_BILLING_LINKS,
        collectionStartedOn,
        attemptSummary: {
          attempts: sourceSummaries.reduce(
            (total, summary) => total + summary.attempts,
            0,
          ),
          estimatedAiImportCostUsd: sourceSummaries.reduce(
            (total, summary) => total + summary.estimatedAiImportCostUsd,
            0,
          ),
          supadataCredits: attemptsBySource.reduce(
            (total, summary) => total + (summary._sum.supadataCredits ?? 0),
            0,
          ),
          supadataOperationsStarted: attemptsBySource.reduce(
            (total, summary) =>
              total + (summary._sum.supadataOperationsStarted ?? 0),
            0,
          ),
          supadataUnknownOperationCount: attemptsBySource.reduce(
            (total, summary) =>
              total + (summary._sum.supadataUnknownOperationCount ?? 0),
            0,
          ),
          sources: sourceSummaries,
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
