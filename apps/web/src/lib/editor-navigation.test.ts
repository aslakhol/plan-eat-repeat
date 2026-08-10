import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCreateDinnerEditorHref,
  buildDinnerEditorHref,
  editorCancelHref,
  editorSaveHref,
  parseEditorNavigation,
  planSlotDateFromDate,
} from "./editor-navigation";

void test("manual creation preserves a typed name and Cookbook origin", () => {
  assert.deepEqual(
    buildCreateDinnerEditorHref({
      origin: "cookbook",
      mode: "manual",
      name: "  Tomato soup  ",
    }),
    {
      pathname: "/dinners/new",
      query: {
        origin: "cookbook",
        mode: "manual",
        name: "Tomato soup",
      },
    },
  );
});

void test("a Week origin carries a valid local Plan Slot date", () => {
  const navigation = parseEditorNavigation({
    origin: "week",
    date: "2026-08-12",
    name: "Risotto",
    mode: "manual",
  });

  assert.deepEqual(navigation, {
    origin: "week",
    date: "2026-08-12",
    name: "Risotto",
    mode: "manual",
  });
  assert.deepEqual(editorSaveHref(42, navigation), {
    pathname: "/",
    query: { date: "2026-08-12" },
  });
  assert.equal(editorCancelHref(navigation), "/");
});

void test("invalid or array query values cannot become a Plan Slot date", () => {
  assert.deepEqual(
    parseEditorNavigation({
      origin: ["week", "cookbook"],
      date: "2026-02-30",
      name: ["One", "Two"],
      mode: "manual",
    }),
    { origin: "cookbook", mode: "manual" },
  );
});

void test("global Week creation still saves to Cookbook when no date is attached", () => {
  const navigation = parseEditorNavigation({ origin: "week" });

  assert.equal(editorSaveHref(42, navigation), "/dinners/42");
  assert.equal(editorCancelHref(navigation), "/");
});

void test("editing from a planned-day sheet retains the return contract", () => {
  const date = planSlotDateFromDate(new Date(2026, 7, 12));

  assert.deepEqual(buildDinnerEditorHref(42, { origin: "week", date }), {
    pathname: "/dinners/42",
    query: { edit: "1", origin: "week", date: "2026-08-12" },
  });
});

void test("Cookbook Save reopens the URL-addressed Dinner and Cancel resets the tab", () => {
  const navigation = parseEditorNavigation({ origin: "cookbook" });

  assert.equal(editorSaveHref(42, navigation), "/dinners/42");
  assert.equal(editorCancelHref(navigation), "/dinners");
});
