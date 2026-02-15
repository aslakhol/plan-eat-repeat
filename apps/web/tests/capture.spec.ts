import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const captureWebDir = path.resolve(currentDir, "../../../capture/web");

async function ensureSignedIn(page: Page) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const weeklyPlanHeading = page.getByRole("heading", { name: "Weekly Plan" });
    if (await weeklyPlanHeading.isVisible().catch(() => false)) {
      return;
    }

    const settingsHeading = page.getByRole("heading", { name: "Settings" });
    if (await settingsHeading.isVisible().catch(() => false)) {
      throw new Error(
        "Signed in but redirected to Settings. The local bypass user likely has no household metadata, so Plan/Dinners cannot be captured.",
      );
    }

    const localLoginButton = page.getByRole("button", { name: "local login" });
    if (await localLoginButton.isVisible().catch(() => false)) {
      await localLoginButton.click();
      await page.waitForTimeout(1500);
    }
  }

  await expect(page.getByRole("heading", { name: "Weekly Plan" })).toBeVisible({
    timeout: 30_000,
  });
}

async function captureScreen(
  page: Page,
  pagePath: string,
  heading: string,
  outputFileName: string,
) {
  await mkdir(captureWebDir, { recursive: true });

  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(captureWebDir, outputFileName),
    fullPage: false,
    type: "png",
  });
}

test("capture plan screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(page, "/", "Weekly Plan", "plan.png");
});

test("capture dinners screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(page, "/dinners", "Dinners", "dinners.png");
});
