import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());
test.use({ hasTouch: true });

test("shopping preparation leaves cold editing usable and reuses warm choices", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const name = `Preload ${crypto.randomUUID()}`;
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      category: "OWN_ITEMS",
      usuallyHave: true,
      items: { create: { amount: 1 } },
    },
  });
  const gate = Promise.withResolvers<void>();
  const reads = new Map<string, number>();
  let warmingStarted = false;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    const procedures = new URL(request.url()).pathname
      .split("/api/trpc/")[1]!
      .split(",");
    if (request.method() === "GET") {
      for (const procedure of procedures)
        reads.set(procedure, (reads.get(procedure) ?? 0) + 1);
      if (procedures.includes("shoppingList.categories")) {
        warmingStarted = true;
        await gate.promise;
      }
    }
    await route.continue();
  });
  const count = (procedure: string) => reads.get(procedure) ?? 0;
  try {
    await page.goto("/shopping-list");
    const edit = page.getByRole("button", {
      name: `Edit ${name}`,
      exact: true,
    });
    await expect(edit).toBeVisible();
    await expect.poll(() => warmingStarted).toBe(true);
    await edit.tap();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await expect(editor.getByRole("switch")).toBeChecked();
    await expect(editor.getByRole("switch")).toBeEnabled();
    await expect(editor.getByLabel("Amount", { exact: true })).toBeEditable();
    expect(count("shoppingList.usuallyHave")).toBe(0);
    expect(count("dinner.ingredientNames")).toBe(0);
    gate.resolve();
    await expect(
      editor.getByRole("combobox", { name: "Category" }),
    ).toBeEnabled();
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();

    const initialCategories = count("shoppingList.categories");
    const initialSources = count("shoppingList.sources");
    const initialList = count("shoppingList.list");
    await edit.press("Enter");
    await editor.getByLabel("Amount", { exact: true }).fill("2");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await edit.tap();
    await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("2");
    // Observe two household polling periods while the editor stays open.
    await expect
      .poll(() => count("shoppingList.list"), { timeout: 8_000 })
      .toBeGreaterThan(initialList + 2);
    expect(count("shoppingList.categories")).toBe(initialCategories);
    expect(count("shoppingList.sources")).toBe(initialSources);
    expect(count("shoppingList.usuallyHave")).toBe(0);
    await editor.getByRole("button", { name: "Done", exact: true }).click();

    const add = page.getByRole("button", { name: "Add an item", exact: true });
    const prepared = page.waitForResponse(
      (response) =>
        response.url().includes("plan.plannedDinners") &&
        response.request().method() === "GET",
    );
    await add.press("Enter");
    const drawer = page.getByRole("dialog", {
      name: "Add an item",
      exact: true,
    });
    await expect(drawer).toBeVisible();
    await expect.poll(() => count("dinner.summaries")).toBeGreaterThan(0);
    await expect.poll(() => count("plan.plannedDinners")).toBeGreaterThan(0);
    await prepared;
    const summaries = count("dinner.summaries");
    const plans = count("plan.plannedDinners");
    await drawer.getByRole("button", { name: "From week plan" }).tap();
    const picker = page.getByRole("dialog", {
      name: "Add dinners",
      exact: true,
    });
    await expect(picker.getByRole("status")).not.toBeVisible();
    await picker.getByRole("button", { name: "Cookbook", exact: true }).tap();
    await expect(picker.getByPlaceholder("Search the cookbook…")).toBeVisible();
    expect(count("dinner.summaries")).toBe(summaries);
    expect(count("plan.plannedDinners")).toBe(plans);
    expect(count("shoppingList.sources")).toBe(initialSources);
    console.log(
      JSON.stringify({
        categories: initialCategories,
        sources: initialSources,
        editorPreferenceReads: count("shoppingList.usuallyHave"),
        cookbookReads: summaries,
        planReads: plans,
      }),
    );
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" }).catch(() => undefined);
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});

test("failed shopping preparation can recover without blocking basic editing", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const name = `Preparation failure ${crypto.randomUUID()}`;
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      category: "OWN_ITEMS",
      usuallyHave: true,
      items: { create: {} },
    },
  });
  let fail = true;
  await page.route("**/api/trpc/**", async (route) => {
    if (fail && route.request().url().includes("shoppingList.categories")) {
      await route.abort("failed");
      return;
    }
    await route.continue();
  });
  try {
    await page.goto("/shopping-list");
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await expect(editor.getByRole("alert")).toContainText(
      "Could not load categories",
    );
    await expect(editor.getByRole("switch")).toBeChecked();
    await editor.getByLabel("Amount", { exact: true }).fill("3");
    fail = false;
    await editor
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await expect(
      editor.getByRole("combobox", { name: "Category" }),
    ).toBeEnabled();
    await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("3");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("3");
  } finally {
    await page.unrouteAll({ behavior: "wait" }).catch(() => undefined);
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});
