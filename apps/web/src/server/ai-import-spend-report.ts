import type { AiImportInferenceState, AiImportSource } from "@planeatrepeat/db";

import {
  AI_IMPORT_SPEND_PERIOD_LABELS,
  AI_IMPORT_SPEND_SOURCES,
  type AiImportSpendDay,
  type AiImportSpendPeriod,
  type OsloDate,
} from "~/lib/ai-import-spend";

const OSLO_TIME_ZONE = "Europe/Oslo";
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const HISTORY_WINDOW_DAYS = 60;
const HISTORY_STEP_DAYS = 30;

const osloDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const osloDateTimeFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type AiImportSpendReportAttempt = {
  source: AiImportSource;
  startedAt: Date;
  householdAttributionKey: string;
  inferenceState: AiImportInferenceState;
  estimatedAiImportCostUsd: number | null;
  supadataOperationsStarted: number;
  supadataCredits: number;
  supadataUnknownOperationCount: number;
};

const IMPORT_SOURCE_ORDER = [
  "TEXT",
  "PHOTO",
  "YOUTUBE",
  "INSTAGRAM",
  "LINK",
] as const satisfies ReadonlyArray<AiImportSource>;

export const osloDate = (instant: Date): OsloDate => {
  const parts = dateParts(osloDateFormatter, instant);
  return `${parts.year}-${parts.month}-${parts.day}` as OsloDate;
};

export const osloDayStartsAt = (date: OsloDate): Date => {
  const { year, month, day } = parseDate(date);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let instant = localMidnightAsUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const osloParts = dateParts(osloDateTimeFormatter, new Date(instant));
    const osloWallTimeAsUtc = Date.UTC(
      Number(osloParts.year),
      Number(osloParts.month) - 1,
      Number(osloParts.day),
      Number(osloParts.hour),
      Number(osloParts.minute),
      Number(osloParts.second),
    );
    const offset = osloWallTimeAsUtc - instant;
    instant = localMidnightAsUtc - offset;
  }

  return new Date(instant);
};

export const getAiImportSpendPeriod = (
  period: AiImportSpendPeriod,
  now: Date,
  collectionStartedOn: Date | null,
) => {
  const today = osloDate(now);
  const startDate =
    period === "7"
      ? addCalendarDays(today, -6)
      : period === "30"
        ? addCalendarDays(today, -29)
        : period === "month"
          ? (`${today.slice(0, 7)}-01` as OsloDate)
          : collectionStartedOn
            ? osloDate(collectionStartedOn)
            : today;

  return {
    startDate,
    startsAt: osloDayStartsAt(startDate),
  };
};

export const buildAiImportSpendReport = ({
  attempts,
  period,
  chartOffset,
  now,
}: {
  attempts: ReadonlyArray<AiImportSpendReportAttempt>;
  period: AiImportSpendPeriod;
  chartOffset: number;
  now: Date;
}) => {
  const reportAttempts = attempts
    .filter((attempt) => attempt.startedAt <= now)
    .toSorted(
      (left, right) => left.startedAt.getTime() - right.startedAt.getTime(),
    );
  const collectionStartedOn = reportAttempts[0]?.startedAt ?? null;
  const selectedPeriod = getAiImportSpendPeriod(
    period,
    now,
    collectionStartedOn,
  );
  const periodAttempts = reportAttempts.filter(
    (attempt) => attempt.startedAt >= selectedPeriod.startsAt,
  );
  const representedHouseholds = distinctHouseholds(reportAttempts).size;
  const importSources = summarizeImportSources(periodAttempts);

  return {
    collectionStartedOn,
    attemptSummary: summarizeAllAttempts(reportAttempts),
    last24Hours: summarizeLast24Hours(reportAttempts, now, collectionStartedOn),
    period: summarizePeriod(
      periodAttempts,
      period,
      representedHouseholds,
      importSources,
    ),
    importSources,
    dailyWindow: buildDailyWindow({
      attempts: periodAttempts,
      period,
      periodStartDate: selectedPeriod.startDate,
      today: osloDate(now),
      requestedChartOffset: chartOffset,
    }),
  };
};

const summarizeImportSources = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
) =>
  AI_IMPORT_SPEND_SOURCES.map(({ source }) => {
    const sourceAttempts = attempts.filter(
      (attempt) => attempt.source === source,
    );
    const pricedAttempts = sourceAttempts.filter(
      (attempt) => attempt.inferenceState === "ESTIMATED",
    );
    const estimatedAiImportCostUsd = aiImportCost(sourceAttempts);
    const recordedSupadataCredits = supadataCredits(sourceAttempts);

    return {
      source,
      attempts: sourceAttempts.length,
      pricedAttempts: pricedAttempts.length,
      estimatedAiImportCostUsd,
      unknownInferenceAttempts: sourceAttempts.filter(
        (attempt) => attempt.inferenceState === "UNKNOWN",
      ).length,
      supadataOperationsStarted: sum(
        sourceAttempts.map((attempt) => attempt.supadataOperationsStarted),
      ),
      supadataCredits: recordedSupadataCredits,
      supadataUnknownOperationCount: sum(
        sourceAttempts.map((attempt) => attempt.supadataUnknownOperationCount),
      ),
      averageAiImportCostUsd:
        pricedAttempts.length === 0
          ? 0
          : estimatedAiImportCostUsd / pricedAttempts.length,
      averageSupadataCredits:
        sourceAttempts.length === 0
          ? 0
          : recordedSupadataCredits / sourceAttempts.length,
    };
  });

const summarizeAllAttempts = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
) => {
  const sources = IMPORT_SOURCE_ORDER.map((source) => {
    const sourceAttempts = attempts.filter(
      (attempt) => attempt.source === source,
    );
    return {
      source,
      attempts: sourceAttempts.length,
      estimatedAiImportCostUsd: sum(
        sourceAttempts.map((attempt) => attempt.estimatedAiImportCostUsd ?? 0),
      ),
    };
  });

  return {
    attempts: attempts.length,
    estimatedAiImportCostUsd: sum(
      attempts.map((attempt) => attempt.estimatedAiImportCostUsd ?? 0),
    ),
    supadataCredits: sum(attempts.map((attempt) => attempt.supadataCredits)),
    supadataOperationsStarted: sum(
      attempts.map((attempt) => attempt.supadataOperationsStarted),
    ),
    supadataUnknownOperationCount: sum(
      attempts.map((attempt) => attempt.supadataUnknownOperationCount),
    ),
    sources,
  };
};

const summarizeLast24Hours = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
  now: Date,
  collectionStartedOn: Date | null,
) => {
  const recentStartsAt = new Date(now.getTime() - DAY_IN_MILLISECONDS);
  const previousStartsAt = new Date(now.getTime() - 2 * DAY_IN_MILLISECONDS);
  const recentAttempts = attempts.filter(
    (attempt) => attempt.startedAt >= recentStartsAt,
  );
  const previousAttempts = attempts.filter(
    (attempt) =>
      attempt.startedAt >= previousStartsAt &&
      attempt.startedAt < recentStartsAt,
  );
  const completedDays = completedAverageDays(now, collectionStartedOn);
  const attemptsByDate = groupAttemptsByOsloDate(attempts);
  const completedDayTotals = completedDays.map((date) =>
    summarizeDay(date, attemptsByDate.get(date) ?? []),
  );

  return {
    aiImportCostUsd: aiImportCost(recentAttempts),
    supadataCredits: supadataCredits(recentAttempts),
    previousAiImportCostUsd: aiImportCost(previousAttempts),
    previousSupadataCredits: supadataCredits(previousAttempts),
    meanDailyAiImportCostUsd: mean(
      completedDayTotals.map((day) => day.aiImportCostUsd),
    ),
    meanDailySupadataCredits: mean(
      completedDayTotals.map((day) => day.supadataCredits),
    ),
    medianDailyAiImportCostUsd: median(
      completedDayTotals.map((day) => day.aiImportCostUsd),
    ),
    medianDailySupadataCredits: median(
      completedDayTotals.map((day) => day.supadataCredits),
    ),
    completedDaysInAverage: completedDays.length,
    activeHouseholds: distinctHouseholds(recentAttempts).size,
    attempts: recentAttempts.length,
    attemptsUsingSupadata: recentAttempts.filter(usedSupadata).length,
  };
};

const summarizePeriod = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
  period: AiImportSpendPeriod,
  representedHouseholds: number,
  importSources: ReturnType<typeof summarizeImportSources>,
) => {
  const pricedAttempts = attempts.filter(
    (attempt) => attempt.inferenceState === "ESTIMATED",
  );
  const knownAiImportCost = sum(
    importSources.map((source) => source.estimatedAiImportCostUsd),
  );
  const knownSupadataCredits = sum(
    importSources.map((source) => source.supadataCredits),
  );

  return {
    key: period,
    label: AI_IMPORT_SPEND_PERIOD_LABELS[period],
    aiImportCostUsd: knownAiImportCost,
    supadataCredits: knownSupadataCredits,
    attempts: attempts.length,
    attemptsUsingSupadata: attempts.filter(usedSupadata).length,
    activeHouseholds: distinctHouseholds(attempts).size,
    representedHouseholds,
    pricedAttempts: pricedAttempts.length,
    noChargeAttempts: attempts.filter(
      (attempt) => attempt.inferenceState === "NOT_INCURRED",
    ).length,
    pendingInferenceAttempts: attempts.filter(
      (attempt) => attempt.inferenceState === "PENDING",
    ).length,
    unknownInferenceAttempts: attempts.filter(
      (attempt) => attempt.inferenceState === "UNKNOWN",
    ).length,
    supadataUnknownOperationCount: sum(
      attempts.map((attempt) => attempt.supadataUnknownOperationCount),
    ),
    averageAiImportCostUsd:
      pricedAttempts.length === 0
        ? 0
        : knownAiImportCost / pricedAttempts.length,
    averageSupadataCredits:
      attempts.length === 0 ? 0 : knownSupadataCredits / attempts.length,
  };
};

const buildDailyWindow = ({
  attempts,
  period,
  periodStartDate,
  today,
  requestedChartOffset,
}: {
  attempts: ReadonlyArray<AiImportSpendReportAttempt>;
  period: AiImportSpendPeriod;
  periodStartDate: OsloDate;
  today: OsloDate;
  requestedChartOffset: number;
}) => {
  if (attempts.length === 0) {
    return { days: [], chartOffset: 0, maximumChartOffset: 0 };
  }

  const dates = calendarDates(periodStartDate, today);
  const maximumChartOffset =
    period === "all"
      ? Math.max(
          0,
          Math.ceil((dates.length - HISTORY_WINDOW_DAYS) / HISTORY_STEP_DAYS),
        )
      : 0;
  const chartOffset =
    period === "all" ? Math.min(requestedChartOffset, maximumChartOffset) : 0;
  const windowEndsAt = dates.length - chartOffset * HISTORY_STEP_DAYS;
  const windowStartsAt = Math.max(0, windowEndsAt - HISTORY_WINDOW_DAYS);
  const windowDates = dates.slice(windowStartsAt, windowEndsAt);
  const attemptsByDate = groupAttemptsByOsloDate(attempts);

  return {
    days: windowDates.map((date) =>
      summarizeDay(date, attemptsByDate.get(date) ?? []),
    ),
    chartOffset,
    maximumChartOffset,
  };
};

const summarizeDay = (
  date: OsloDate,
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
): AiImportSpendDay => ({
  date,
  aiImportCostUsd: aiImportCost(attempts),
  supadataCredits: supadataCredits(attempts),
  attempts: attempts.length,
});

const completedAverageDays = (
  now: Date,
  collectionStartedOn: Date | null,
): OsloDate[] => {
  if (!collectionStartedOn) return [];

  const yesterday = addCalendarDays(osloDate(now), -1);
  const collectionDate = osloDate(collectionStartedOn);
  if (collectionDate > yesterday) return [];

  const earliestIncludedDate = addCalendarDays(yesterday, -29);
  return calendarDates(
    collectionDate > earliestIncludedDate
      ? collectionDate
      : earliestIncludedDate,
    yesterday,
  );
};

const aiImportCost = (attempts: ReadonlyArray<AiImportSpendReportAttempt>) =>
  sum(attempts.map((attempt) => attempt.estimatedAiImportCostUsd ?? 0));

const supadataCredits = (attempts: ReadonlyArray<AiImportSpendReportAttempt>) =>
  sum(attempts.map((attempt) => attempt.supadataCredits));

const usedSupadata = (attempt: AiImportSpendReportAttempt) =>
  attempt.supadataOperationsStarted > 0;

const distinctHouseholds = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
) => new Set(attempts.map((attempt) => attempt.householdAttributionKey));

const groupAttemptsByOsloDate = (
  attempts: ReadonlyArray<AiImportSpendReportAttempt>,
) => {
  const attemptsByDate = new Map<OsloDate, AiImportSpendReportAttempt[]>();
  for (const attempt of attempts) {
    const date = osloDate(attempt.startedAt);
    const dateAttempts = attemptsByDate.get(date) ?? [];
    dateAttempts.push(attempt);
    attemptsByDate.set(date, dateAttempts);
  }
  return attemptsByDate;
};

const mean = (values: ReadonlyArray<number>) =>
  values.length === 0 ? 0 : sum(values) / values.length;

const median = (values: ReadonlyArray<number>) => {
  if (values.length === 0) return 0;
  const sortedValues = values.toSorted((left, right) => left - right);
  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2 === 0
    ? ((sortedValues[middle - 1] ?? 0) + (sortedValues[middle] ?? 0)) / 2
    : (sortedValues[middle] ?? 0);
};

const sum = (values: ReadonlyArray<number>) =>
  values.reduce((total, value) => total + value, 0);

const calendarDates = (start: OsloDate, end: OsloDate): OsloDate[] => {
  if (start > end) return [];
  const dates: OsloDate[] = [];
  for (let date = start; date <= end; date = addCalendarDays(date, 1)) {
    dates.push(date);
  }
  return dates;
};

const addCalendarDays = (date: OsloDate, numberOfDays: number): OsloDate => {
  const { year, month, day } = parseDate(date);
  const result = new Date(Date.UTC(year, month - 1, day + numberOfDays));
  return `${result.getUTCFullYear()}-${String(
    result.getUTCMonth() + 1,
  ).padStart(
    2,
    "0",
  )}-${String(result.getUTCDate()).padStart(2, "0")}` as OsloDate;
};

const parseDate = (date: OsloDate) => {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) throw new Error(`Invalid Oslo date: ${date}`);
  return { year, month, day };
};

const dateParts = (formatter: Intl.DateTimeFormat, date: Date) =>
  Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<string, string>;
