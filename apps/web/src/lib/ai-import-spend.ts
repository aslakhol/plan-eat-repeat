export const AI_IMPORT_SPEND_PERIOD_KEYS = ["7", "30", "month", "all"] as const;

export type AiImportSpendPeriod = (typeof AI_IMPORT_SPEND_PERIOD_KEYS)[number];

export type OsloDate = `${number}-${number}-${number}`;

export type AiImportSpendDay = {
  date: OsloDate;
  aiImportCostUsd: number;
  supadataCredits: number;
  attempts: number;
};

export const AI_IMPORT_SPEND_PERIOD_LABELS: Record<
  AiImportSpendPeriod,
  string
> = {
  "7": "7 days",
  "30": "30 days",
  month: "This month",
  all: "All time",
};

export const formatAiImportSpendUsd = (amount: number, fractionDigits = 2) =>
  `$${amount.toFixed(fractionDigits)}`;

export const formatAiImportSpendCredits = (credits: number) =>
  `${credits.toLocaleString("en-US", {
    maximumFractionDigits: Math.abs(credits) < 10 ? 1 : 0,
  })} cr`;
