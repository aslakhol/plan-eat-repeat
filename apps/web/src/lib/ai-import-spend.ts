export const AI_IMPORT_SPEND_PERIOD_KEYS = ["7", "30", "month", "all"] as const;

export const AI_IMPORT_SPEND_SOURCES = [
  { source: "YOUTUBE", label: "YouTube", color: "hsl(18 72% 56%)" },
  { source: "INSTAGRAM", label: "Instagram", color: "hsl(6 48% 63%)" },
  { source: "LINK", label: "Link", color: "hsl(32 42% 68%)" },
  { source: "TEXT", label: "Text", color: "hsl(42 28% 79%)" },
  { source: "PHOTO", label: "Photo", color: "hsl(150 14% 62%)" },
] as const;

export type AiImportSpendSource =
  (typeof AI_IMPORT_SPEND_SOURCES)[number]["source"];

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
