import React, { useEffect, useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  formatAiImportSpendCredits,
  formatAiImportSpendUsd,
} from "~/lib/ai-import-spend";
import { cn } from "~/lib/utils";

type SpendMetrics = {
  attempts: number;
  estimatedAiImportCostUsd: number;
  supadataCredits: number;
};

export type SpendMember = SpendMetrics & {
  key: string;
  name: string;
  available: boolean;
};

export type SpendHousehold = SpendMetrics & {
  key: string;
  name: string;
  available: boolean;
  currentMemberCount: number | null;
  members: ReadonlyArray<SpendMember>;
};

type Ranking = "inference" | "credits";

export const HouseholdsCard = ({
  periodLabel,
  period,
  households,
  hasRecordedAttempts,
}: {
  periodLabel: string;
  period: { aiImportCostUsd: number; supadataCredits: number };
  households: ReadonlyArray<SpendHousehold>;
  hasRecordedAttempts: boolean;
}) => {
  const [ranking, setRanking] = useState<Ranking>("inference");
  const rankedHouseholds = useMemo(
    () => rankHouseholds(households, ranking),
    [households, ranking],
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(() =>
    firstAvailableHouseholdKey(rankHouseholds(households, "inference")),
  );

  useEffect(() => {
    setExpandedKey((currentKey) =>
      households.some((household) => household.key === currentKey)
        ? currentKey
        : firstAvailableHouseholdKey(rankedHouseholds),
    );
  }, [households, rankedHouseholds]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 px-5 pb-3 pt-6 sm:px-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <CardTitle className="font-serif text-lg font-normal">
            Households
          </CardTitle>
        </div>
        {households.length > 0 && (
          <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="text-muted-foreground text-[13px]">
              {periodLabel} · ranked by
            </span>
            <RankingControl ranking={ranking} onChange={setRanking} />
          </div>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-2 sm:px-7">
        {households.length === 0 ? (
          <div className="border-t py-11 text-center">
            <p className="font-serif text-[17px]">
              {hasRecordedAttempts
                ? "No AI Import Attempts in this period"
                : "No AI Import Attempts yet"}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {hasRecordedAttempts
                ? "Choose another period to inspect earlier activity."
                : "Data starts with the first AI Import Attempt."}
            </p>
          </div>
        ) : (
          <>
            <div className="text-muted-foreground hidden grid-cols-[20px_minmax(0,1.5fr)_minmax(120px,1fr)_88px_86px_84px] items-center gap-4 px-2 pb-2 text-[11px] uppercase tracking-[0.04em] lg:grid">
              <span />
              <span />
              <span>Share of all spend</span>
              <span className="text-right">Attempts</span>
              <span className="text-right">Inference</span>
              <span className="text-right">Credits</span>
            </div>
            {rankedHouseholds.map((household) => {
              const expanded = expandedKey === household.key;
              const membersId = `household-members-${household.key}`;

              return (
                <div key={household.key} className="border-t">
                  <button
                    type="button"
                    data-household-row={household.key}
                    aria-expanded={expanded}
                    aria-controls={membersId}
                    className={cn(
                      "hover:bg-secondary/60 focus-visible:ring-ring grid w-full grid-cols-[20px_minmax(0,1fr)] items-center gap-x-3 gap-y-4 rounded-lg px-2 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 lg:grid-cols-[20px_minmax(0,1.5fr)_minmax(120px,1fr)_88px_86px_84px] lg:gap-4",
                      expanded && "bg-secondary/60",
                    )}
                    onClick={() =>
                      setExpandedKey(expanded ? null : household.key)
                    }
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "text-muted-foreground text-[11px] transition-transform duration-150",
                        expanded && "rotate-90",
                      )}
                    >
                      ▶
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block truncate font-serif text-base",
                          !household.available && "text-muted-foreground",
                        )}
                      >
                        {household.name}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {household.available
                          ? memberCountLabel(household.currentMemberCount ?? 0)
                          : "deleted · history retained"}
                      </span>
                    </span>
                    <ShareBars
                      id={`household-${household.key}`}
                      inferenceValue={household.estimatedAiImportCostUsd}
                      inferenceDenominator={period.aiImportCostUsd}
                      creditsValue={household.supadataCredits}
                      creditsDenominator={period.supadataCredits}
                      minimumVisiblePercentage={1}
                      size="household"
                      inferenceLabel="period inference spend"
                      creditsLabel="period Supadata credits"
                    />
                    <MetricCells metrics={household} />
                  </button>
                  {expanded && (
                    <div
                      id={membersId}
                      data-member-list={household.key}
                      role="region"
                      aria-label={`${household.name} represented members`}
                      className="pb-4 pl-8 lg:pl-11"
                    >
                      {household.members.map((member) => (
                        <div
                          key={member.key}
                          className="grid grid-cols-1 items-center gap-3 border-b py-3 pl-2 lg:grid-cols-[minmax(0,1.5fr)_minmax(120px,1fr)_88px_86px_84px] lg:gap-4 lg:py-2"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              aria-hidden="true"
                              className="bg-secondary text-muted-foreground flex size-6 flex-none items-center justify-center rounded-full text-[11px] font-bold"
                            >
                              {memberInitials(member)}
                            </span>
                            <span
                              className={cn(
                                "truncate text-sm",
                                !member.available && "text-muted-foreground",
                              )}
                            >
                              {member.name}
                            </span>
                          </div>
                          <ShareBars
                            id={`member-${member.key}`}
                            inferenceValue={member.estimatedAiImportCostUsd}
                            inferenceDenominator={
                              household.estimatedAiImportCostUsd
                            }
                            creditsValue={member.supadataCredits}
                            creditsDenominator={household.supadataCredits}
                            minimumVisiblePercentage={2}
                            size="member"
                            inferenceLabel={`${household.name} inference spend`}
                            creditsLabel={`${household.name} Supadata credits`}
                          />
                          <MetricCells metrics={member} compact />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </CardContent>
    </Card>
  );
};

const RankingControl = ({
  ranking,
  onChange,
}: {
  ranking: Ranking;
  onChange: (ranking: Ranking) => void;
}) => (
  <div
    role="group"
    aria-label="Household ranking"
    className="bg-secondary inline-flex w-fit rounded-[10px] border p-[3px]"
  >
    {(
      [
        ["inference", "Inference $"],
        ["credits", "Supadata cr"],
      ] as const
    ).map(([key, label]) => (
      <button
        key={key}
        type="button"
        data-household-ranking={key}
        aria-pressed={ranking === key}
        className={cn(
          "text-muted-foreground focus-visible:ring-ring rounded-[7px] px-3 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2",
          ranking === key && "bg-card text-foreground shadow-sm",
        )}
        onClick={() => onChange(key)}
      >
        {label}
      </button>
    ))}
  </div>
);

const ShareBars = ({
  id,
  inferenceValue,
  inferenceDenominator,
  creditsValue,
  creditsDenominator,
  minimumVisiblePercentage,
  size,
  inferenceLabel,
  creditsLabel,
}: {
  id: string;
  inferenceValue: number;
  inferenceDenominator: number;
  creditsValue: number;
  creditsDenominator: number;
  minimumVisiblePercentage: number;
  size: "household" | "member";
  inferenceLabel: string;
  creditsLabel: string;
}) => (
  <span
    className={cn(
      "flex flex-col gap-1 lg:col-span-1",
      size === "household" ? "col-span-2" : "col-span-1",
    )}
  >
    <ShareBar
      dataId={`${size}-inference-${id.replace(`${size}-`, "")}`}
      value={inferenceValue}
      denominator={inferenceDenominator}
      minimumVisiblePercentage={minimumVisiblePercentage}
      label={inferenceLabel}
      className={size === "household" ? "h-[7px]" : "h-[5px]"}
      fillClassName={
        size === "household" ? "bg-[hsl(18_72%_58%)]" : "bg-[hsl(18_60%_72%)]"
      }
    />
    <ShareBar
      dataId={`${size}-credits-${id.replace(`${size}-`, "")}`}
      value={creditsValue}
      denominator={creditsDenominator}
      minimumVisiblePercentage={minimumVisiblePercentage}
      label={creditsLabel}
      className={size === "household" ? "h-[7px]" : "h-[5px]"}
      fillClassName={
        size === "household" ? "bg-[hsl(150_16%_42%)]" : "bg-[hsl(150_14%_58%)]"
      }
    />
  </span>
);

const ShareBar = ({
  dataId,
  value,
  denominator,
  minimumVisiblePercentage,
  label,
  className,
  fillClassName,
}: {
  dataId: string;
  value: number;
  denominator: number;
  minimumVisiblePercentage: number;
  label: string;
  className: string;
  fillClassName: string;
}) => {
  const exactShare = denominator > 0 ? (value / denominator) * 100 : 0;
  const renderedShare =
    value > 0 ? Math.max(minimumVisiblePercentage, exactShare) : 0;

  return (
    <span
      className={cn(
        "bg-secondary block overflow-hidden rounded-full",
        className,
      )}
      role="img"
      aria-label={`${formatPercentage(exactShare)} of ${label}`}
    >
      {renderedShare > 0 && (
        <span
          data-share-fill={dataId}
          className={cn("block h-full rounded-full", fillClassName)}
          style={{ width: `${Math.min(100, renderedShare)}%` }}
        />
      )}
    </span>
  );
};

const MetricCells = ({
  metrics,
  compact = false,
}: {
  metrics: SpendMetrics;
  compact?: boolean;
}) => (
  <span
    className={cn(
      "grid grid-cols-3 gap-3 lg:contents",
      compact ? "col-span-1" : "col-span-2",
    )}
  >
    <Metric label="Attempts" value={String(metrics.attempts)} muted />
    <Metric
      label="Inference"
      value={formatAiImportSpendUsd(metrics.estimatedAiImportCostUsd)}
      compact={compact}
    />
    <Metric
      label="Credits"
      value={formatAiImportSpendCredits(metrics.supadataCredits)}
      compact={compact}
      credits
    />
  </span>
);

const Metric = ({
  label,
  value,
  muted = false,
  credits = false,
  compact = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
  credits?: boolean;
  compact?: boolean;
}) => (
  <span className="min-w-0 text-right">
    <span className="text-muted-foreground block text-[10px] uppercase lg:hidden">
      {label}
    </span>
    <span
      className={cn(
        "mt-0.5 block font-semibold lg:mt-0",
        compact ? "text-sm" : "text-base",
        muted && "text-muted-foreground text-[13px] font-normal",
        credits && "text-[hsl(150_18%_30%)]",
      )}
    >
      {value}
    </span>
  </span>
);

const rankHouseholds = (
  households: ReadonlyArray<SpendHousehold>,
  ranking: Ranking,
) =>
  households.toSorted((left, right) => {
    const selectedDifference =
      ranking === "inference"
        ? right.estimatedAiImportCostUsd - left.estimatedAiImportCostUsd
        : right.supadataCredits - left.supadataCredits;
    return (
      selectedDifference ||
      right.attempts - left.attempts ||
      left.name.localeCompare(right.name)
    );
  });

const memberCountLabel = (count: number) =>
  `${count} ${count === 1 ? "member" : "members"}`;

const memberInitials = (member: SpendMember) => {
  if (!member.available) return "–";
  return member.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const formatPercentage = (percentage: number) => `${percentage.toFixed(1)}%`;

const firstAvailableHouseholdKey = (
  households: ReadonlyArray<SpendHousehold>,
) =>
  households.find((household) => household.available)?.key ??
  households[0]?.key ??
  null;
