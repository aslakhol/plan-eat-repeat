export const AI_IMPORT_SPEND_PERIOD_KEYS = [
  "7",
  "30",
  "month",
  "all",
] as const;

export type AiImportSpendPeriod =
  (typeof AI_IMPORT_SPEND_PERIOD_KEYS)[number];

export const AI_IMPORT_SPEND_PERIOD_LABELS: Record<
  AiImportSpendPeriod,
  string
> = {
  "7": "7 days",
  "30": "30 days",
  month: "This month",
  all: "All time",
};
