import { expect, type Locator, test } from "@playwright/test";

import { ensureSignedIn } from "./capture-support";

const expectBoundedDesktopDialog = async (dialog: Locator) => {
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1280);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(800);
  expect(bounds!.width).toBeLessThanOrEqual(560);
};

test("import empty, loading, error, no-match, and missing clipboard states stay recoverable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await ensureSignedIn(page);
  await page.goto("/dinners");
  const search = page.getByRole("searchbox", { name: "Search dinners" });
  await search.fill(`No match ${Date.now()}`);
  await expect(
    page.getByRole("heading", { name: "No dinners match" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator('a[href^="/dinners/"]').first()).toBeVisible();

  await page.getByRole("button", { name: "Add Dinner" }).click();
  await page.getByRole("button", { name: "Photos" }).click();
  await expect(page.getByText("No photos yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose photos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ Add a dinner" }).click();
  await page.getByRole("button", { name: "Link" }).click();

  const urlInput = page.getByRole("textbox", { name: "Recipe URL" });
  const importButton = page.getByRole("button", { name: "Import recipe" });
  await expect(urlInput).toHaveValue("");
  await expect(importButton).toBeDisabled();
  await urlInput.fill("not-a-url");
  await expect(
    page.getByRole("alert").filter({
      hasText: "Enter a full http or https URL.",
    }),
  ).toBeVisible();

  let releaseImportRequest: () => void = () => undefined;
  const importRequestGate = new Promise<void>((resolve) => {
    releaseImportRequest = resolve;
  });
  await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
    await importRequestGate;
    await route.abort();
  });
  const unreachableUrl = "https://127.0.0.1:1/recipe";
  await urlInput.fill(unreachableUrl);
  await importButton.click();
  await expect(
    page.getByRole("heading", { name: "Reading the recipe" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  releaseImportRequest();
  await expect(urlInput).toHaveValue(unreachableUrl);

  await page.unroute("**/api/trpc/dinner.importFromUrl**");
  await importButton.click();
  await expect(
    page.getByRole("heading", { name: "Couldn't reach the site" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write it myself" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(urlInput).toHaveValue(unreachableUrl);
});

test("desktop import progress and errors stay in a bounded, recoverable dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await ensureSignedIn(page);

  let releaseImportRequest: () => void = () => undefined;
  const importRequestGate = new Promise<void>((resolve) => {
    releaseImportRequest = resolve;
  });
  await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
    await importRequestGate;
    await route.abort();
  });

  await page.getByRole("button", { name: "Add Dinner" }).click();
  await page.getByRole("button", { name: "Link" }).click();
  const urlInput = page.getByRole("textbox", { name: "Recipe URL" });
  await urlInput.fill("https://example.com/recipe");
  await page.getByRole("button", { name: "Import recipe" }).click();

  const progressDialog = page.getByRole("dialog", {
    name: "Reading the recipe",
  });
  await expectBoundedDesktopDialog(progressDialog);

  await page.getByRole("button", { name: "Cancel" }).click();
  releaseImportRequest();
  await expect(urlInput).toHaveValue("https://example.com/recipe");

  await page.unroute("**/api/trpc/dinner.importFromUrl**");
  await page.route("**/api/trpc/dinner.importFromUrl**", (route) =>
    route.abort(),
  );
  await page.getByRole("button", { name: "Import recipe" }).click();
  const errorDialog = page.getByRole("dialog", {
    name: "Couldn't finish the recipe",
  });
  await expectBoundedDesktopDialog(errorDialog);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write it myself" }),
  ).toBeVisible();
});
