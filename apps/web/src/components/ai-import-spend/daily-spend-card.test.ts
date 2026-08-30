import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DailySpendCard } from "./daily-spend-card";

void test("daily spend renders independent axes and keyboard-readable day details", () => {
  const html = renderToStaticMarkup(
    createElement(DailySpendCard, {
      periodLabel: "All time",
      dailyWindow: {
        chartOffset: 0,
        maximumChartOffset: 1,
        days: [
          {
            date: "2026-08-29",
            aiImportCostUsd: 2,
            supadataCredits: 1,
            attempts: 3,
          },
          {
            date: "2026-08-30",
            aiImportCostUsd: 1,
            supadataCredits: 10,
            attempts: 4,
          },
        ],
      },
      onShowOlder: () => undefined,
      onShowNewer: () => undefined,
    }),
  );

  assert.match(
    html,
    /aria-label="29 August 2026: \$2\.00 inference, 1 cr Supadata, 3 AI Import Attempts"/,
  );
  assert.match(
    html,
    /aria-label="30 August 2026: \$1\.00 inference, 10 cr Supadata, 4 AI Import Attempts"/,
  );
  assert.match(html, /height:145px;background-color:hsl\(18 70% 62%\)/);
  assert.match(html, /height:145px;background-color:hsl\(150 16% 42%\)/);
  assert.match(html, />Daily values</);
  assert.match(html, /Show older daily spend/);
  assert.match(html, /Show newer daily spend/);
  assert.match(html, /disabled=""[^>]*aria-label="Show newer daily spend"/);

  const oldestWindowHtml = renderToStaticMarkup(
    createElement(DailySpendCard, {
      periodLabel: "All time",
      dailyWindow: {
        chartOffset: 1,
        maximumChartOffset: 1,
        days: [
          {
            date: "2026-08-29",
            aiImportCostUsd: 2,
            supadataCredits: 1,
            attempts: 3,
          },
        ],
      },
      onShowOlder: () => undefined,
      onShowNewer: () => undefined,
    }),
  );
  assert.match(
    oldestWindowHtml,
    /disabled=""[^>]*aria-label="Show older daily spend"/,
  );
  assert.doesNotMatch(
    oldestWindowHtml,
    /disabled=""[^>]*aria-label="Show newer daily spend"/,
  );
});

void test("daily spend replaces an empty plot with the period no-data message", () => {
  const html = renderToStaticMarkup(
    createElement(DailySpendCard, {
      periodLabel: "7 days",
      dailyWindow: {
        chartOffset: 0,
        maximumChartOffset: 0,
        days: [],
      },
      onShowOlder: () => undefined,
      onShowNewer: () => undefined,
    }),
  );

  assert.match(html, /No AI Import Attempts in this period/);
  assert.doesNotMatch(html, /Inference axis/);
});
