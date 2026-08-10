import { expect, test } from "@playwright/test";

import {
  assertNoHorizontalOverflow,
  deleteDinnerFromEditor,
  deleteDinnerIfPresent,
  ensureSignedIn,
  openFirstEmptyDay,
  quickAddDinner,
} from "./capture-support";

test("global quick-add opens a URL-addressed Cookbook sheet", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const dinnerName = `Quick add ${Date.now()}`;

  try {
    const addDinnerButton = page.getByRole("button", { name: "Add Dinner" });
    await expect(page.getByRole("link", { name: "Week" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cookbook" })).toBeVisible();
    await expect(addDinnerButton).toBeVisible();
    await quickAddDinner(page, dinnerName);
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/dinners$/);
    await expect(
      page.getByRole("heading", { name: dinnerName }),
    ).not.toBeVisible();
    await page.getByRole("link", { name: dinnerName }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/dinners$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/dinners\/\d+$/);
    await expect(
      page.getByRole("heading", { name: dinnerName }),
    ).not.toBeVisible();
  } finally {
    await deleteDinnerIfPresent(page, dinnerName);
  }
});

test("empty Plan Slot manual creation saves and opens the planned-day sheet", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const dinnerName = `Planned manual ${Date.now()}`;
  let cleanedUp = false;

  try {
    await openFirstEmptyDay(page);
    await page.getByRole("button", { name: "New dinner" }).click();
    await page.getByPlaceholder("What's for dinner?").fill(dinnerName);
    await page.getByRole("button", { name: "Write it myself" }).click();
    await expect(
      page.getByRole("heading", { name: "New dinner" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      dinnerName,
    );
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/?date=\d{4}-\d{2}-\d{2}$/);
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();
    await expect(page.getByText("Planned Dinner actions")).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: "Planned Dinner actions" })
      .click();
    await page.getByRole("link", { name: "Edit this Dinner" }).click();
    await deleteDinnerFromEditor(page);
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
    cleanedUp = true;
  } finally {
    if (!cleanedUp) await deleteDinnerIfPresent(page, dinnerName);
  }
});

test("critical Week and Cookbook actions remain reachable across responsive widths", async ({
  page,
}) => {
  await ensureSignedIn(page);
  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 480, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Dinner" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.goto("/dinners");
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Dinner" }),
    ).toBeVisible();
    await expect(page.locator('a[href^="/dinners/"]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await openFirstEmptyDay(page);
  await expect(page.getByRole("button", { name: "New dinner" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Surprise me!" }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
});
