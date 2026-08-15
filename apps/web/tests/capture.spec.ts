import { expect, test } from "@playwright/test";

import { captureScreen, ensureSignedIn } from "./capture-support";

test("capture plan screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(page, "/", "Week", "plan.png");
});

test("capture dinners screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(page, "/dinners", "Cookbook", "dinners.png");
});

test("capture plan first-day drawer screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(
    page,
    "/",
    "Week",
    "plan-first-day-drawer.png",
    async (currentPage) => {
      const firstDay = currentPage.getByTestId("plan-day-trigger").first();
      await expect(firstDay).toBeVisible({ timeout: 30_000 });
      await firstDay.click();
      const planDayButtons = currentPage.locator(
        "button:has-text('Surprise me!'), button:has-text('Change dinner')",
      );
      await expect(planDayButtons.first()).toBeVisible({ timeout: 30_000 });
    },
  );
});
