import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";

import { HouseholdsCard, type SpendHousehold } from "./households-card";

const households: SpendHousehold[] = [
  {
    key: "household-alpha",
    name: "Alpha Household",
    available: true,
    currentMemberCount: 2,
    attempts: 2,
    estimatedAiImportCostUsd: 0.01,
    supadataCredits: 10,
    members: [
      {
        key: "member-ada",
        name: "Ada Lovelace",
        available: true,
        attempts: 1,
        estimatedAiImportCostUsd: 0.0001,
        supadataCredits: 0,
      },
      {
        key: "member-removed",
        name: "Member unavailable",
        available: false,
        attempts: 1,
        estimatedAiImportCostUsd: 0.0099,
        supadataCredits: 10,
      },
    ],
  },
  {
    key: "household-beta",
    name: "Beta Household",
    available: true,
    currentMemberCount: 1,
    attempts: 4,
    estimatedAiImportCostUsd: 0.99,
    supadataCredits: 1,
    members: [
      {
        key: "member-grace",
        name: "Grace Hopper",
        available: true,
        attempts: 1,
        estimatedAiImportCostUsd: 0.001,
        supadataCredits: 0,
      },
      {
        key: "member-beta-removed",
        name: "Member unavailable",
        available: false,
        attempts: 3,
        estimatedAiImportCostUsd: 0.989,
        supadataCredits: 1,
      },
    ],
  },
  {
    key: "household-deleted",
    name: "Household unavailable",
    available: false,
    currentMemberCount: null,
    attempts: 1,
    estimatedAiImportCostUsd: 0,
    supadataCredits: 0,
    members: [
      {
        key: "member-deleted",
        name: "Member unavailable",
        available: false,
        attempts: 1,
        estimatedAiImportCostUsd: 0,
        supadataCredits: 0,
      },
    ],
  },
];

const props = {
  periodLabel: "7 days",
  period: { aiImportCostUsd: 2, supadataCredits: 20 },
  households,
};

void test("Households renders accessible rankings, retained attribution, and exact-denominator share bars", () => {
  const html = renderToStaticMarkup(createElement(HouseholdsCard, props));

  assert.ok(html.indexOf("Beta Household") < html.indexOf("Alpha Household"));
  assert.match(
    html,
    /data-household-row="household-beta"[^>]*aria-expanded="true"/,
  );
  assert.match(html, /Alpha Household[\s\S]*2 members/);
  assert.match(html, /Household unavailable[\s\S]*deleted · history retained/);
  assert.match(html, /Member unavailable/);
  assert.match(
    html,
    /data-share-fill="household-inference-household-alpha"[^>]*style="width:1%"/,
  );
  assert.match(
    html,
    /data-share-fill="member-inference-member-grace"[^>]*style="width:2%"/,
  );
  assert.doesNotMatch(
    html,
    /data-share-fill="household-inference-household-deleted"/,
  );
  assert.doesNotMatch(html, /data-share-fill="member-credits-member-grace"/);
  assert.match(html, /aria-label="0\.5% of period inference spend"/);
  assert.match(html, /grid-cols-3[^"]*lg:contents/);
  assert.match(html, /lg:grid-cols-\[20px_minmax\(0,1\.5fr\)/);
});

void test("Household ranking changes row order without changing measures and expansion stays exclusive", async () => {
  const { document, window } = parseHTML(
    "<!doctype html><html><body><div id=app></div></body></html>",
  );
  Object.assign(globalThis, {
    document,
    window,
    Node: window.Node,
    Element: window.Element,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  const { createRoot } = await import("react-dom/client");
  const { act } = await import("react");
  const container = document.querySelector("#app");
  assert.ok(container);
  const root = createRoot(container);

  act(() => root.render(createElement(HouseholdsCard, props)));

  const rowNames = () =>
    Array.from(document.querySelectorAll("[data-household-row]")).map((row) =>
      row.getAttribute("data-household-row"),
    );
  assert.deepEqual(rowNames(), [
    "household-beta",
    "household-alpha",
    "household-deleted",
  ]);

  const creditsRanking = document.querySelector(
    '[data-household-ranking="credits"]',
  );
  assert.ok(creditsRanking);
  act(() => {
    creditsRanking.dispatchEvent(new window.Event("click", { bubbles: true }));
  });
  assert.deepEqual(rowNames(), [
    "household-alpha",
    "household-beta",
    "household-deleted",
  ]);
  assert.equal(
    document.querySelectorAll('[data-share-fill^="household-"]').length,
    4,
  );

  const alphaRow = document.querySelector(
    '[data-household-row="household-alpha"]',
  );
  assert.ok(alphaRow);
  act(() => {
    alphaRow.dispatchEvent(new window.Event("click", { bubbles: true }));
  });
  assert.equal(
    document.querySelectorAll('[data-household-row][aria-expanded="true"]')
      .length,
    1,
  );
  assert.equal(alphaRow.getAttribute("aria-expanded"), "true");
  assert.equal(
    document.querySelector('[data-member-list="household-alpha"]') !== null,
    true,
  );
  assert.equal(
    document.querySelector('[data-member-list="household-beta"]'),
    null,
  );

  act(() => root.unmount());
});

void test("Households shows the selected-period empty state", () => {
  const html = renderToStaticMarkup(
    createElement(HouseholdsCard, { ...props, households: [] }),
  );

  assert.match(html, /No AI Import Attempts in this period/);
  assert.doesNotMatch(html, /data-household-ranking=/);
});
