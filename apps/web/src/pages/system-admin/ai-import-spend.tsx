import { useState, type ReactElement } from "react";
import { getAuth } from "@clerk/nextjs/server";
import type { GetServerSideProps } from "next";
import Head from "next/head";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { env } from "~/env";
import {
  AI_IMPORT_SPEND_PERIOD_KEYS,
  AI_IMPORT_SPEND_PERIOD_LABELS,
  type AiImportSpendPeriod,
} from "~/lib/ai-import-spend";
import { cn } from "~/lib/utils";
import {
  isSystemAdminUser,
  parseSystemAdminUserIds,
} from "~/server/system-admin";
import { api, type RouterOutputs } from "~/utils/api";

type DashboardProjection = RouterOutputs["aiImportSpend"]["dashboard"];

export default function AiImportSpendPage() {
  const [period, setPeriod] = useState<AiImportSpendPeriod>("7");
  const dashboardQuery = api.aiImportSpend.dashboard.useQuery({
    period,
    chartOffset: 0,
  });

  return (
    <>
      <Head>
        <title>AI import spend | Plan Eat Repeat</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="min-h-screen bg-background px-4 pb-16 pt-8 text-foreground sm:px-8 lg:px-10 lg:pt-12">
        <main
          className="mx-auto flex w-full max-w-[1080px] flex-col gap-7"
          aria-busy={dashboardQuery.isPending}
        >
          {dashboardQuery.data ? (
            <Dashboard
              projection={dashboardQuery.data}
              selectedPeriod={period}
              onPeriodChange={setPeriod}
            />
          ) : (
            <DashboardLoading />
          )}
        </main>
      </div>
    </>
  );
}

AiImportSpendPage.getLayout = (page: ReactElement) => page;

const Dashboard = ({
  projection,
  selectedPeriod,
  onPeriodChange,
}: {
  projection: DashboardProjection;
  selectedPeriod: AiImportSpendPeriod;
  onPeriodChange: (period: AiImportSpendPeriod) => void;
}) => (
  <>
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <h1 className="font-serif text-[30px] leading-[1.1]">AI import spend</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {projection.environment}
        </p>
      </div>
      <PeriodControl
        selectedPeriod={selectedPeriod}
        onPeriodChange={onPeriodChange}
      />
    </header>

    <section
      aria-label="Spend overview"
      className="grid gap-5 lg:grid-cols-[1.15fr_1fr]"
    >
      <Last24HoursCard projection={projection} />
      <SummaryCard projection={projection} />
    </section>

    <EmptyReportCard title="Daily spend" />
    <EmptyReportCard title="Households" />
    <EmptySourcesCard periodLabel={projection.period.label} />

    <section aria-label="Provider billing" className="flex flex-wrap gap-2.5">
      <Button variant="outline" size="sm" asChild>
        <a
          href={projection.billingLinks.anthropic}
          target="_blank"
          rel="noopener noreferrer"
        >
          Inference billing <span aria-hidden="true">↗</span>
        </a>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a
          href={projection.billingLinks.supadata}
          target="_blank"
          rel="noopener noreferrer"
        >
          Supadata billing <span aria-hidden="true">↗</span>
        </a>
      </Button>
    </section>

    <footer className="space-y-2 text-xs leading-5 text-muted-foreground">
      <p className="flex gap-2">
        <span aria-hidden="true">ⓘ</span>
        <span>
          Inference cost is an estimate · collection starts with the first AI
          Import Attempt
        </span>
      </p>
      <p className="flex gap-2">
        <span aria-hidden="true">ⓘ</span>
        <span>
          Supadata credits are counted as spent and never converted to USD.
          Remaining allowance is not exposed by the API, so it is not shown.
        </span>
      </p>
    </footer>
  </>
);

const PeriodControl = ({
  selectedPeriod,
  onPeriodChange,
}: {
  selectedPeriod: AiImportSpendPeriod;
  onPeriodChange: (period: AiImportSpendPeriod) => void;
}) => (
  <div className="flex-none">
    <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      Period
    </p>
    <div
      className="inline-flex max-w-full overflow-x-auto rounded-[11px] border bg-secondary p-[3px]"
      role="group"
      aria-label="Reporting period"
    >
      {AI_IMPORT_SPEND_PERIOD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={selectedPeriod === key}
          className={cn(
            "shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            selectedPeriod === key &&
              "bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
          )}
          onClick={() => onPeriodChange(key)}
        >
          {AI_IMPORT_SPEND_PERIOD_LABELS[key]}
        </button>
      ))}
    </div>
  </div>
);

const Last24HoursCard = ({
  projection,
}: {
  projection: DashboardProjection;
}) => (
  <Card>
    <CardContent className="p-5 sm:p-7">
      <p className="text-[13px] font-semibold text-muted-foreground">
        Last 24 hours
      </p>
      <div className="mt-5 grid grid-cols-2">
        <SpendFigure
          value={formatUsd(projection.last24Hours.aiImportCostUsd)}
          label="Inference"
        />
        <SpendFigure
          value={formatCredits(projection.last24Hours.supadataCredits)}
          label="Supadata credits"
          creditTone
          showDivider
        />
      </div>
      <p className="mt-4 text-[13px] text-muted-foreground">
        Previous 24 hours:{" "}
        {formatUsd(projection.last24Hours.previousAiImportCostUsd)} ·{" "}
        {formatCredits(projection.last24Hours.previousSupadataCredits)}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
        <HeroMetric
          label="Mean daily"
          value={formatUsd(projection.last24Hours.meanDailyAiImportCostUsd)}
          detail={
            formatCredits(projection.last24Hours.meanDailySupadataCredits) +
            " · " +
            projection.last24Hours.completedDaysInAverage +
            "d"
          }
        />
        <HeroMetric
          label="Median daily"
          value={formatUsd(projection.last24Hours.medianDailyAiImportCostUsd)}
          detail={
            formatCredits(projection.last24Hours.medianDailySupadataCredits) +
            " · " +
            projection.last24Hours.completedDaysInAverage +
            "d"
          }
        />
        <HeroMetric
          label="Households"
          value={String(projection.last24Hours.activeHouseholds)}
          detail="active in 24h"
        />
        <HeroMetric
          label="Attempts"
          value={String(projection.last24Hours.attempts)}
          detail={
            projection.last24Hours.attemptsUsingSupadata + " used Supadata"
          }
        />
      </div>
    </CardContent>
  </Card>
);

const SummaryCard = ({
  projection,
}: {
  projection: DashboardProjection;
}) => {
  const tiles = [
    {
      label: "Inference spend",
      value: formatUsd(projection.period.aiImportCostUsd),
      note: projection.period.label,
    },
    {
      label: "Supadata credits",
      value: formatCredits(projection.period.supadataCredits),
      note: projection.period.label,
      credits: true,
    },
    {
      label: "AI Import Attempts",
      value:
        projection.period.attempts +
        "/" +
        projection.period.attemptsUsingSupadata,
      note: "total / used Supadata",
    },
    {
      label: "Active Households",
      value: String(projection.period.activeHouseholds),
      note: "of " + projection.period.representedHouseholds + " represented",
    },
    {
      label: "Avg inference / priced attempt",
      value: formatUsd(projection.period.averageAiImportCostUsd, 3),
      note:
        projection.period.noChargeAttempts +
        " no charge · " +
        projection.period.unknownInferenceAttempts +
        " unknown",
    },
    {
      label: "Avg credits / attempt",
      value: formatCredits(projection.period.averageSupadataCredits),
      note: "across all " + projection.period.attempts + " attempts",
      credits: true,
    },
  ];

  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-x-5 gap-y-7 p-5 sm:p-7">
        {tiles.map((tile) => (
          <div key={tile.label}>
            <p className="text-xs font-semibold text-muted-foreground">
              {tile.label}
            </p>
            <p
              className={cn(
                "mt-1 font-serif text-2xl",
                tile.credits && "text-[hsl(150_18%_30%)]",
              )}
            >
              {tile.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.note}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

const SpendFigure = ({
  value,
  label,
  creditTone = false,
  showDivider = false,
}: {
  value: string;
  label: string;
  creditTone?: boolean;
  showDivider?: boolean;
}) => (
  <div className={cn(showDivider && "border-l pl-5 sm:pl-7")}>
    <p
      className={cn(
        "font-serif text-4xl leading-none sm:text-[44px]",
        creditTone && "text-[hsl(150_18%_30%)]",
      )}
    >
      {value}
    </p>
    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}
    </p>
  </div>
);

const HeroMetric = ({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) => (
  <div>
    <p className="whitespace-nowrap text-[11px] text-muted-foreground">
      {label}
    </p>
    <p className="mt-0.5 text-[17px] font-semibold">{value}</p>
    <p className="text-xs font-semibold text-[hsl(150_18%_32%)]">{detail}</p>
  </div>
);

const EmptyReportCard = ({ title }: { title: string }) => (
  <Card>
    <CardHeader className="px-5 pb-4 pt-6 sm:px-7">
      <CardTitle className="font-serif text-lg font-normal">{title}</CardTitle>
    </CardHeader>
    <CardContent className="border-t px-5 py-11 text-center sm:px-7">
      <p className="font-serif text-[17px]">No AI Import Attempts yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Data starts with the first AI Import Attempt.
      </p>
    </CardContent>
  </Card>
);

const EmptySourcesCard = ({ periodLabel }: { periodLabel: string }) => (
  <Card>
    <CardHeader className="flex-row items-center justify-between space-y-0 px-5 pb-4 pt-6 sm:px-7">
      <CardTitle className="font-serif text-lg font-normal">
        Import sources
      </CardTitle>
      <p className="text-[13px] text-muted-foreground">{periodLabel}</p>
    </CardHeader>
    <CardContent className="border-t px-5 py-11 text-center sm:px-7">
      <p className="font-serif text-[17px]">
        No AI Import Attempts in this period
      </p>
    </CardContent>
  </Card>
);

const DashboardLoading = () => (
  <div className="space-y-5" role="status">
    <Skeleton className="h-16 rounded-lg" />
    <div className="grid gap-5 lg:grid-cols-2">
      <Skeleton className="h-72 rounded-lg" />
      <Skeleton className="h-72 rounded-lg" />
    </div>
    <Skeleton className="h-48 rounded-lg" />
    <span className="sr-only">Loading AI import spend</span>
  </div>
);

const formatUsd = (amount: number, fractionDigits = 2) =>
  "$" + amount.toFixed(fractionDigits);

const formatCredits = (credits: number) => credits.toLocaleString() + " cr";

export const getServerSideProps = (({ req }) => {
  const { userId } = getAuth(req);
  const systemAdminUserIds = parseSystemAdminUserIds(
    env.SYSTEM_ADMIN_CLERK_USER_IDS,
  );

  if (!isSystemAdminUser(userId, systemAdminUserIds)) {
    return Promise.resolve({ notFound: true });
  }

  return Promise.resolve({ props: {} });
}) satisfies GetServerSideProps;
