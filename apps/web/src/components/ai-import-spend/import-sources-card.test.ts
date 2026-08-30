import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";

import { ImportSourcesCard } from "./import-sources-card";

const importSources = [
  {
    source: "YOUTUBE" as const,
    attempts: 3,
    pricedAttempts: 2,
    estimatedAiImportCostUsd: 0.6,
    unknownInferenceAttempts: 1,
    supadataOperationsStarted: 3,
    supadataCredits: 4,
    supadataUnknownOperationCount: 1,
    averageAiImportCostUsd: 0.3,
    averageSupadataCredits: 4 / 3,
  },
  {
    source: "INSTAGRAM" as const,
    attempts: 1,
    pricedAttempts: 0,
    estimatedAiImportCostUsd: 0,
    unknownInferenceAttempts: 0,
    supadataOperationsStarted: 1,
    supadataCredits: 5,
    supadataUnknownOperationCount: 0,
    averageAiImportCostUsd: 0,
    averageSupadataCredits: 5,
  },
  {
    source: "LINK" as const,
    attempts: 5,
    pricedAttempts: 1,
    estimatedAiImportCostUsd: 0.1,
    unknownInferenceAttempts: 0,
    supadataOperationsStarted: 1,
    supadataCredits: 0,
    supadataUnknownOperationCount: 1,
    averageAiImportCostUsd: 0.1,
    averageSupadataCredits: 0,
  },
  {
    source: "TEXT" as const,
    attempts: 4,
    pricedAttempts: 2,
    estimatedAiImportCostUsd: 0.2,
    unknownInferenceAttempts: 0,
    supadataOperationsStarted: 0,
    supadataCredits: 0,
    supadataUnknownOperationCount: 0,
    averageAiImportCostUsd: 0.1,
    averageSupadataCredits: 0,
  },
  {
    source: "PHOTO" as const,
    attempts: 2,
    pricedAttempts: 0,
    estimatedAiImportCostUsd: 0,
    unknownInferenceAttempts: 2,
    supadataOperationsStarted: 0,
    supadataCredits: 0,
    supadataUnknownOperationCount: 0,
    averageAiImportCostUsd: 0,
    averageSupadataCredits: 0,
  },
];

void test("Import Sources renders fixed, accessible pies and volume-sorted legends", () => {
  const html = renderToStaticMarkup(
    createElement(ImportSourcesCard, {
      periodLabel: "7 days",
      period: {
        attempts: 15,
        aiImportCostUsd: 0.9,
        supadataCredits: 9,
      },
      importSources,
    }),
  );

  assert.equal((html.match(/data-pie-chart=/g) ?? []).length, 3);
  assert.equal((html.match(/data-pie-slice=/g) ?? []).length, 10);
  assert.match(
    html,
    /data-measure="attempts"[\s\S]*fill="hsl\(18 72% 56%\)"[\s\S]*fill="hsl\(6 48% 63%\)"[\s\S]*fill="hsl\(32 42% 68%\)"[\s\S]*fill="hsl\(42 28% 79%\)"[\s\S]*fill="hsl\(150 14% 62%\)"/,
  );
  assert.match(
    html,
    /aria-label="YouTube: 3 attempts, 20\.0%"[^>]*role="button"[^>]*tabindex="0"/,
  );
  assert.match(
    html,
    /data-legend="attempts"[\s\S]*Link[\s\S]*Text[\s\S]*YouTube[\s\S]*Photo[\s\S]*Instagram/,
  );
  assert.match(
    html,
    /data-legend="supadataCredits"[\s\S]*YouTube[\s\S]*Instagram/,
  );
  assert.match(
    html,
    /data-legend-item="YOUTUBE"[^>]*aria-label="YouTube: 4 cr, 44\.4%"/,
  );
  assert.doesNotMatch(
    html,
    /data-legend="supadataCredits"[\s\S]*Link[^<]*0 cr/,
  );
});

void test("Import Sources discloses source averages, unknowns, and no-call sources", () => {
  const html = renderToStaticMarkup(
    createElement(ImportSourcesCard, {
      periodLabel: "7 days",
      period: {
        attempts: 15,
        aiImportCostUsd: 0.9,
        supadataCredits: 9,
      },
      importSources,
    }),
  );

  assert.equal((html.match(/data-source-summary=/g) ?? []).length, 5);
  assert.match(html, /YouTube[\s\S]*\$0\.300 per priced attempt/);
  assert.match(html, /YouTube[\s\S]*1 unknown inference/);
  assert.match(html, /YouTube[\s\S]*1 unknown Supadata operation/);
  assert.match(html, /Link[\s\S]*0 cr per attempt/);
  assert.match(html, /Text[\s\S]*No Supadata call/);
  assert.match(html, /Photo[\s\S]*No Supadata call/);
  assert.doesNotMatch(html, /&gt;/);
  assert.match(html, /grid-cols-1[^"]*lg:grid-cols-3/);
  assert.match(html, /grid-cols-1[^"]*sm:grid-cols-2[^"]*lg:grid-cols-5/);
});

void test("Import Sources replaces zero pies with the period empty state", () => {
  const html = renderToStaticMarkup(
    createElement(ImportSourcesCard, {
      periodLabel: "This month",
      period: {
        attempts: 0,
        aiImportCostUsd: 0,
        supadataCredits: 0,
      },
      importSources: importSources.map((source) => ({
        ...source,
        attempts: 0,
        pricedAttempts: 0,
        estimatedAiImportCostUsd: 0,
        unknownInferenceAttempts: 0,
        supadataOperationsStarted: 0,
        supadataCredits: 0,
        supadataUnknownOperationCount: 0,
        averageAiImportCostUsd: 0,
        averageSupadataCredits: 0,
      })),
    }),
  );

  assert.match(html, /No import attempts in this period\./);
  assert.match(html, /This month/);
  assert.doesNotMatch(html, /data-pie-chart=/);
});

void test("Import Source details open from focus and toggle from touch", async () => {
  const { document, window } = parseHTML(
    "<!doctype html><html><body><div id=app></div></body></html>",
  );
  Object.assign(globalThis, {
    document,
    window,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    SVGElement: window.SVGElement,
    Event: window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const container = document.querySelector("#app");
  assert.ok(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(ImportSourcesCard, {
        periodLabel: "7 days",
        period: {
          attempts: 15,
          aiImportCostUsd: 0.9,
          supadataCredits: 9,
        },
        importSources,
      }),
    );
  });

  const youtubeSlice = document.querySelector(
    '[data-measure="attempts"] [data-pie-slice="YOUTUBE"]',
  );
  assert.ok(youtubeSlice);
  act(() => {
    youtubeSlice.dispatchEvent(new window.Event("focusin", { bubbles: true }));
  });
  assert.match(
    document.querySelector('[role="tooltip"]')?.textContent ?? "",
    /YouTube/,
  );

  const escape = new window.Event("keydown", {
    bubbles: true,
    cancelable: true,
  });
  Object.defineProperty(escape, "key", { value: "Escape" });
  act(() => {
    youtubeSlice.dispatchEvent(escape);
  });
  assert.equal(document.querySelector('[role="tooltip"]'), null);

  const youtubeLegend = document.querySelector(
    '[data-legend="attempts"] [data-legend-item="YOUTUBE"]',
  );
  assert.ok(youtubeLegend);
  act(() => {
    youtubeLegend.dispatchEvent(
      new window.Event("touchend", { bubbles: true, cancelable: true }),
    );
  });
  assert.match(
    document.querySelector('[role="tooltip"]')?.textContent ?? "",
    /20\.0%/,
  );
  act(() => {
    youtubeLegend.dispatchEvent(
      new window.Event("touchend", { bubbles: true, cancelable: true }),
    );
  });
  assert.equal(document.querySelector('[role="tooltip"]'), null);

  act(() => root.unmount());
});
