import React from "react";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  formatAiImportSpendCredits,
  formatAiImportSpendUsd,
  type AiImportSpendDay,
} from "~/lib/ai-import-spend";

export type DailySpendWindow = {
  days: AiImportSpendDay[];
  chartOffset: number;
  maximumChartOffset: number;
};

export const DailySpendCard = ({
  periodLabel,
  dailyWindow,
  onShowOlder,
  onShowNewer,
}: {
  periodLabel: string;
  dailyWindow: DailySpendWindow;
  onShowOlder: () => void;
  onShowNewer: () => void;
}) => {
  const { days } = dailyWindow;

  return (
    <Card>
      <CardHeader className="gap-3 px-5 pb-4 pt-6 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 sm:px-7">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <CardTitle className="font-serif text-lg font-normal">
            Daily spend
          </CardTitle>
          <div
            className="text-muted-foreground flex items-center gap-4 text-xs"
            aria-label="Chart legend"
          >
            <Legend color="hsl(18 70% 62%)" label="Inference $" />
            <Legend color="hsl(150 16% 42%)" label="Supadata cr" />
          </div>
        </div>
        <p className="text-muted-foreground text-[13px]">
          {days.length} {days.length === 1 ? "day" : "days"}
        </p>
      </CardHeader>

      <CardContent className="border-t px-5 pb-6 pt-5 sm:px-7">
        {days.length === 0 ? (
          <div className="py-7 text-center">
            <p className="font-serif text-[17px]">
              No import attempts in this period.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{periodLabel}</p>
          </div>
        ) : (
          <>
            {dailyWindow.maximumChartOffset > 0 && (
              <HistoryPager
                days={days}
                chartOffset={dailyWindow.chartOffset}
                maximumChartOffset={dailyWindow.maximumChartOffset}
                onShowOlder={onShowOlder}
                onShowNewer={onShowNewer}
              />
            )}
            <DailySpendPlot days={days} />
            <DailyValues days={days} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className="h-[9px] w-[9px] rounded-sm"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
    {label}
  </span>
);

const HistoryPager = ({
  days,
  chartOffset,
  maximumChartOffset,
  onShowOlder,
  onShowNewer,
}: {
  days: AiImportSpendDay[];
  chartOffset: number;
  maximumChartOffset: number;
  onShowOlder: () => void;
  onShowNewer: () => void;
}) => (
  <div className="mb-5 flex items-center justify-center gap-2">
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-7 w-7 rounded-lg text-xs"
      disabled={chartOffset >= maximumChartOffset}
      aria-label="Show older daily spend"
      onClick={onShowOlder}
    >
      <span aria-hidden="true">◀</span>
    </Button>
    <p className="text-muted-foreground min-w-[150px] text-center text-xs">
      {formatRange(days)}
    </p>
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="h-7 w-7 rounded-lg text-xs"
      disabled={chartOffset === 0}
      aria-label="Show newer daily spend"
      onClick={onShowNewer}
    >
      <span aria-hidden="true">▶</span>
    </Button>
  </div>
);

const DailySpendPlot = ({ days }: { days: AiImportSpendDay[] }) => {
  const maximumAiImportCost = Math.max(
    ...days.map((day) => day.aiImportCostUsd),
  );
  const maximumSupadataCredits = Math.max(
    ...days.map((day) => day.supadataCredits),
  );
  const labelStride = Math.ceil(days.length / 10);

  return (
    <div className="overflow-x-auto pb-2">
      <div className={days.length > 20 ? "min-w-[640px]" : "min-w-[420px]"}>
        <div className="grid grid-cols-[46px_minmax(0,1fr)_48px] gap-2">
          <Axis
            label="Inference axis"
            maximum={formatAiImportSpendUsd(maximumAiImportCost)}
            tone="text-[hsl(18_40%_42%)]"
          />
          <div className="flex h-[172px] items-end border-b">
            {days.map((day, index) => {
              const dayLabel = describeDay(day);
              const showDateLabel =
                days.length <= 14 ||
                index % labelStride === 0 ||
                index === days.length - 1;

              return (
                <button
                  key={day.date}
                  type="button"
                  className="focus-visible:ring-ring group relative flex h-full min-w-0 flex-1 items-end justify-center gap-px px-px pb-[26px] focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2"
                  aria-label={dayLabel}
                  title={dayLabel}
                >
                  <span
                    className="w-[calc(50%-1px)] max-w-[20px] rounded-t-[4px] transition-colors duration-100 group-hover:bg-[hsl(18_75%_45%)] group-focus:bg-[hsl(18_75%_45%)]"
                    style={{
                      height: barHeight(
                        day.aiImportCostUsd,
                        maximumAiImportCost,
                      ),
                      backgroundColor: "hsl(18 70% 62%)",
                    }}
                    aria-hidden="true"
                  />
                  <span
                    className="w-[calc(50%-1px)] max-w-[20px] rounded-t-[4px] transition-colors duration-100 group-hover:bg-[hsl(150_22%_28%)] group-focus:bg-[hsl(150_22%_28%)]"
                    style={{
                      height: barHeight(
                        day.supadataCredits,
                        maximumSupadataCredits,
                      ),
                      backgroundColor: "hsl(150 16% 42%)",
                    }}
                    aria-hidden="true"
                  />
                  {showDateLabel && (
                    <span className="text-muted-foreground absolute bottom-1 left-1/2 w-12 -translate-x-1/2 whitespace-nowrap text-center text-[10px] group-hover:text-[hsl(24_10%_15%)] group-focus:text-[hsl(24_10%_15%)]">
                      {formatAxisDate(day.date, days.length)}
                    </span>
                  )}
                  <DayTooltip day={day} />
                </button>
              );
            })}
          </div>
          <Axis
            label="Supadata axis"
            maximum={formatAiImportSpendCredits(maximumSupadataCredits)}
            tone="text-[hsl(150_16%_34%)]"
          />
        </div>
      </div>
    </div>
  );
};

const Axis = ({
  label,
  maximum,
  tone,
}: {
  label: string;
  maximum: string;
  tone: string;
}) => (
  <div
    className={`flex h-[172px] flex-col justify-between pb-[22px] text-[10px] ${tone}`}
    aria-label={label}
  >
    <span>{maximum}</span>
    <span>0</span>
  </div>
);

const DayTooltip = ({ day }: { day: AiImportSpendDay }) => (
  <span
    className="pointer-events-none absolute left-1/2 top-1 z-30 hidden w-max max-w-[180px] -translate-x-1/2 rounded-[9px] bg-[hsl(24_12%_14%)] px-3 py-2 text-left text-[hsl(40_25%_96%)] shadow-[0_6px_18px_rgba(40,25,15,.22)] group-hover:block group-focus:block"
    aria-hidden="true"
  >
    <span className="block text-xs font-semibold">
      {formatLongDate(day.date)}
    </span>
    <span className="mt-1 block text-xs">
      {formatAiImportSpendUsd(day.aiImportCostUsd)} inference
    </span>
    <span className="block text-xs">
      {formatAiImportSpendCredits(day.supadataCredits)} Supadata
    </span>
    <span className="mt-1 block text-[11px] text-[hsl(35_12%_70%)]">
      {day.attempts} AI Import {day.attempts === 1 ? "Attempt" : "Attempts"}
    </span>
  </span>
);

const DailyValues = ({ days }: { days: AiImportSpendDay[] }) => (
  <details className="mt-4 text-sm">
    <summary className="text-muted-foreground focus-visible:ring-ring w-fit cursor-pointer rounded-sm text-xs font-semibold focus-visible:outline-none focus-visible:ring-2">
      Daily values
    </summary>
    <ul className="text-muted-foreground mt-3 grid gap-2 text-xs sm:grid-cols-2">
      {days.map((day) => (
        <li key={day.date}>{describeDay(day)}</li>
      ))}
    </ul>
  </details>
);

const barHeight = (value: number, maximum: number) =>
  value === 0 || maximum === 0 ? 0 : Math.max(2, (value / maximum) * 145);

const describeDay = (day: AiImportSpendDay) =>
  `${formatLongDate(day.date)}: ${formatAiImportSpendUsd(day.aiImportCostUsd)} inference, ${formatAiImportSpendCredits(day.supadataCredits)} Supadata, ${day.attempts} AI Import ${day.attempts === 1 ? "Attempt" : "Attempts"}`;

const formatRange = (days: AiImportSpendDay[]) => {
  const firstDay = days[0];
  const lastDay = days.at(-1);
  return firstDay && lastDay
    ? `${formatShortDate(firstDay.date)} – ${formatShortDate(lastDay.date)}`
    : "";
};

const formatAxisDate = (date: string, numberOfDays: number) =>
  numberOfDays <= 14
    ? dateFormatter({ weekday: "short" }).format(dateAtNoon(date))
    : dateFormatter({ day: "numeric", month: "short" }).format(
        dateAtNoon(date),
      );

const formatShortDate = (date: string) =>
  dateFormatter({ day: "numeric", month: "short", year: "numeric" }).format(
    dateAtNoon(date),
  );

const formatLongDate = (date: string) =>
  dateFormatter({ day: "numeric", month: "long", year: "numeric" }).format(
    dateAtNoon(date),
  );

const dateFormatter = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-GB", {
    ...options,
    timeZone: "Europe/Oslo",
  });

const dateAtNoon = (date: string) => new Date(`${date}T12:00:00.000Z`);
