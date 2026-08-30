import React, { useId, useState, type KeyboardEvent } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  formatAiImportSpendCredits,
  formatAiImportSpendUsd,
} from "~/lib/ai-import-spend";

const SOURCE_PRESENTATION = {
  YOUTUBE: { label: "YouTube", color: "hsl(18 72% 56%)" },
  INSTAGRAM: { label: "Instagram", color: "hsl(6 48% 63%)" },
  LINK: { label: "Link", color: "hsl(32 42% 68%)" },
  TEXT: { label: "Text", color: "hsl(42 28% 79%)" },
  PHOTO: { label: "Photo", color: "hsl(150 14% 62%)" },
} as const;

type ImportSource = keyof typeof SOURCE_PRESENTATION;

const SOURCE_ORDER = Object.keys(SOURCE_PRESENTATION) as ImportSource[];

export type ImportSourceSummary = {
  source: ImportSource;
  attempts: number;
  pricedAttempts: number;
  estimatedAiImportCostUsd: number;
  unknownInferenceAttempts: number;
  supadataOperationsStarted: number;
  supadataCredits: number;
  supadataUnknownOperationCount: number;
  averageAiImportCostUsd: number;
  averageSupadataCredits: number;
};

type SourceMeasure =
  | "attempts"
  | "estimatedAiImportCostUsd"
  | "supadataCredits";

const MEASURES: ReadonlyArray<{
  key: SourceMeasure;
  caption: string;
  format: (value: number) => string;
  totalTone?: string;
}> = [
  {
    key: "attempts",
    caption: "Attempts",
    format: (value) => String(value),
  },
  {
    key: "estimatedAiImportCostUsd",
    caption: "Inference spend",
    format: formatAiImportSpendUsd,
  },
  {
    key: "supadataCredits",
    caption: "Supadata credits",
    format: formatAiImportSpendCredits,
    totalTone: "text-[hsl(150_18%_30%)]",
  },
];

export const ImportSourcesCard = ({
  periodLabel,
  period,
  importSources,
}: {
  periodLabel: string;
  period: {
    attempts: number;
    aiImportCostUsd: number;
    supadataCredits: number;
  };
  importSources: ReadonlyArray<ImportSourceSummary>;
}) => {
  const orderedSources = SOURCE_ORDER.map((source) =>
    importSources.find((summary) => summary.source === source),
  ).filter((summary): summary is ImportSourceSummary => Boolean(summary));

  return (
    <Card>
      <CardHeader className="flex-row items-baseline justify-between space-y-0 px-5 pb-[22px] pt-6 sm:px-7">
        <CardTitle className="font-serif text-lg font-normal">
          Import sources
        </CardTitle>
        <p className="text-muted-foreground text-[13px]">{periodLabel}</p>
      </CardHeader>
      <CardContent className="px-5 pb-7 sm:px-7">
        {period.attempts === 0 ? (
          <div className="border-t py-11 text-center">
            <p className="font-serif text-[17px]">
              No import attempts in this period.
            </p>
            <p className="text-muted-foreground mt-1 text-sm">{periodLabel}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-7 lg:grid-cols-3">
              {MEASURES.map((measure) => (
                <SourcePie
                  key={measure.key}
                  measure={measure.key}
                  caption={measure.caption}
                  format={measure.format}
                  total={measureTotal(measure.key, period)}
                  totalTone={measure.totalTone}
                  sources={orderedSources}
                />
              ))}
            </div>
            <SourceAverages sources={orderedSources} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

const SourcePie = ({
  measure,
  caption,
  format,
  total,
  totalTone,
  sources,
}: {
  measure: SourceMeasure;
  caption: string;
  format: (value: number) => string;
  total: number;
  totalTone?: string;
  sources: ReadonlyArray<ImportSourceSummary>;
}) => {
  const titleId = useId();
  const [activeSource, setActiveSource] = useState<ImportSource | null>(null);
  const nonZeroSources = sources.filter((source) => source[measure] > 0);
  const legendSources = nonZeroSources.toSorted(
    (left, right) => right.attempts - left.attempts,
  );
  const activeSummary = nonZeroSources.find(
    (source) => source.source === activeSource,
  );
  let accumulatedValue = 0;

  return (
    <section className="flex min-w-0 flex-col gap-3.5" data-measure={measure}>
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <h3
          id={titleId}
          className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.04em]"
        >
          {caption}
        </h3>
        <p className={`font-serif text-base ${totalTone ?? ""}`}>
          {format(total)}
        </p>
      </div>
      <div className="flex min-h-[110px] min-w-0 items-start gap-4">
        <div className="relative h-[92px] w-[92px] flex-none">
          <svg
            viewBox="0 0 100 100"
            width="92"
            height="92"
            className="block overflow-visible"
            role="group"
            aria-labelledby={titleId}
            data-pie-chart={measure}
          >
            {nonZeroSources.map((source) => {
              const startsAt = accumulatedValue / total;
              accumulatedValue += source[measure];
              const endsAt = accumulatedValue / total;
              const description = describeSlice(source, measure, total, format);

              return (
                <path
                  key={source.source}
                  data-pie-slice={source.source}
                  d={pieSlicePath(startsAt, endsAt)}
                  fill={SOURCE_PRESENTATION[source.source].color}
                  stroke="hsl(0 0% 100%)"
                  strokeWidth="1"
                  aria-label={description}
                  role="button"
                  tabIndex={0}
                  className="focus-visible:outline-none focus-visible:brightness-90"
                  onMouseEnter={() => setActiveSource(source.source)}
                  onMouseLeave={() => setActiveSource(null)}
                  onFocus={() => setActiveSource(source.source)}
                  onBlur={() => setActiveSource(null)}
                  onClick={() => setActiveSource(source.source)}
                  onKeyDown={(event) =>
                    activatePieSlice(event, source.source, setActiveSource)
                  }
                >
                  <title>{description}</title>
                </path>
              );
            })}
          </svg>
          {activeSummary && (
            <div
              role="tooltip"
              className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-10 w-max -translate-x-1/2 rounded-[9px] bg-[hsl(24_12%_14%)] px-[11px] py-2 text-xs text-[hsl(40_25%_96%)] shadow-[0_6px_18px_rgba(40,25,15,.22)]"
            >
              <p className="flex items-center gap-1.5 font-semibold">
                <SourceSwatch source={activeSummary.source} size="small" />
                {SOURCE_PRESENTATION[activeSummary.source].label}
              </p>
              <p className="mt-0.5">
                {format(activeSummary[measure])} ·{" "}
                {formatPercentage(activeSummary[measure], total)}
              </p>
            </div>
          )}
        </div>
        <ul
          className="flex min-w-0 flex-col gap-1.5"
          data-legend={measure}
          aria-label={`${caption} by Import Source`}
        >
          {legendSources.map((source) => {
            const description = describeSlice(source, measure, total, format);

            return (
              <li key={source.source}>
                <button
                  type="button"
                  className="focus-visible:ring-ring flex items-center gap-1.5 whitespace-nowrap rounded-sm text-xs focus-visible:outline-none focus-visible:ring-2"
                  data-legend-item={source.source}
                  aria-label={description}
                  onMouseEnter={() => setActiveSource(source.source)}
                  onMouseLeave={() => setActiveSource(null)}
                  onFocus={() => setActiveSource(source.source)}
                  onBlur={() => setActiveSource(null)}
                  onClick={() => setActiveSource(source.source)}
                  onKeyDown={(event) =>
                    activateLegendItem(event, setActiveSource)
                  }
                >
                  <SourceSwatch source={source.source} />
                  <span className="text-muted-foreground">
                    {SOURCE_PRESENTATION[source.source].label}
                  </span>
                  <span className="font-semibold">
                    {format(source[measure])}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

const SourceAverages = ({
  sources,
}: {
  sources: ReadonlyArray<ImportSourceSummary>;
}) => (
  <section
    className="mt-[22px] border-t pt-3.5"
    aria-labelledby="source-averages"
  >
    <h3 id="source-averages" className="sr-only">
      Import Source averages and unknown values
    </h3>
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
      {sources.map((source) => (
        <article key={source.source} data-source-summary={source.source}>
          <h4 className="flex items-center gap-1.5 text-xs font-semibold">
            <SourceSwatch source={source.source} />
            {SOURCE_PRESENTATION[source.source].label}
          </h4>
          <SourceAverageLines source={source} />
        </article>
      ))}
    </div>
  </section>
);

const SourceAverageLines = ({ source }: { source: ImportSourceSummary }) => (
  <div className="text-muted-foreground mt-1.5 space-y-1 text-[11px] leading-4">
    <p>
      {source.pricedAttempts === 0
        ? "No priced attempt"
        : `${formatAiImportSpendUsd(source.averageAiImportCostUsd, 3)} per priced attempt`}
    </p>
    <p className="text-[hsl(150_18%_30%)]">
      {source.supadataOperationsStarted === 0
        ? "No Supadata call"
        : `${formatAiImportSpendCredits(source.averageSupadataCredits)} per attempt`}
    </p>
    {source.unknownInferenceAttempts > 0 && (
      <p>{countLabel(source.unknownInferenceAttempts, "unknown inference")}</p>
    )}
    {source.supadataUnknownOperationCount > 0 && (
      <p>
        {countLabel(
          source.supadataUnknownOperationCount,
          "unknown Supadata operation",
        )}
      </p>
    )}
  </div>
);

const SourceSwatch = ({
  source,
  size = "ordinary",
}: {
  source: ImportSource;
  size?: "ordinary" | "small";
}) => (
  <span
    className={`${size === "small" ? "h-2 w-2" : "h-[9px] w-[9px]"} flex-none rounded-sm`}
    style={{ backgroundColor: SOURCE_PRESENTATION[source].color }}
    aria-hidden="true"
  />
);

const activatePieSlice = (
  event: KeyboardEvent<SVGPathElement>,
  source: ImportSource,
  setActiveSource: (source: ImportSource | null) => void,
) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    setActiveSource(source);
  } else if (event.key === "Escape") {
    setActiveSource(null);
    event.currentTarget.blur();
  }
};

const activateLegendItem = (
  event: KeyboardEvent<HTMLButtonElement>,
  setActiveSource: (source: ImportSource | null) => void,
) => {
  if (event.key === "Escape") {
    setActiveSource(null);
    event.currentTarget.blur();
  }
};

const describeSlice = (
  source: ImportSourceSummary,
  measure: SourceMeasure,
  total: number,
  format: (value: number) => string,
) =>
  `${SOURCE_PRESENTATION[source.source].label}: ${
    measure === "attempts"
      ? `${source.attempts} ${source.attempts === 1 ? "attempt" : "attempts"}`
      : format(source[measure])
  }, ${formatPercentage(source[measure], total)}`;

const formatPercentage = (value: number, total: number) =>
  `${(total === 0 ? 0 : (value / total) * 100).toFixed(1)}%`;

const pieSlicePath = (startsAt: number, endsAt: number) => {
  const radius = 50;
  const center = 50;
  if (endsAt - startsAt >= 0.9999) {
    return "M 50 0 A 50 50 0 1 1 50 100 A 50 50 0 1 1 50 0 Z";
  }

  const [startX, startY] = pointOnCircle(startsAt, radius, center);
  const [endX, endY] = pointOnCircle(endsAt, radius, center);
  const largeArc = endsAt - startsAt > 0.5 ? 1 : 0;
  return `M ${center} ${center} L ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY} Z`;
};

const pointOnCircle = (fraction: number, radius: number, center: number) => {
  const angle = 2 * Math.PI * fraction - Math.PI / 2;
  return [
    (center + radius * Math.cos(angle)).toFixed(3),
    (center + radius * Math.sin(angle)).toFixed(3),
  ];
};

const measureTotal = (
  measure: SourceMeasure,
  period: {
    attempts: number;
    aiImportCostUsd: number;
    supadataCredits: number;
  },
) =>
  measure === "attempts"
    ? period.attempts
    : measure === "estimatedAiImportCostUsd"
      ? period.aiImportCostUsd
      : period.supadataCredits;

const countLabel = (count: number, singular: string) =>
  `${count} ${singular}${count === 1 ? "" : "s"}`;
