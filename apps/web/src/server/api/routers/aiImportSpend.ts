import { z } from "zod";

import { AI_IMPORT_SPEND_PERIOD_KEYS } from "~/lib/ai-import-spend";
import { buildAiImportSpendReport } from "~/server/ai-import-spend-report";
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
      const now = ctx.reportNow();
      const [attempts, currentHouseholdCount] = await Promise.all([
        ctx.db.aiImportAttempt.findMany({
          where: { startedAt: { lte: now } },
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
        }),
        ctx.db.household.count(),
      ]);
      const report = buildAiImportSpendReport({
        attempts,
        period: input.period,
        chartOffset: input.chartOffset,
        now,
        currentHouseholdCount,
      });

      return {
        environment: ctx.deploymentEnvironment,
        billingLinks: AI_IMPORT_SPEND_BILLING_LINKS,
        ...report,
      };
    }),
});
