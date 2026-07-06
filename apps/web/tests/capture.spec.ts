import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const captureWebDir = path.resolve(currentDir, "../../../capture/web");

async function ensureSignedIn(page: Page) {
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");

    const status = response?.status() ?? 0;
    if (status >= 400) {
      throw new Error(
        `GET / returned ${status}. The web server on port 3000 is not healthy for capture. Restart it with "pnpm dev:web" and check the server logs.`,
      );
    }

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
      const bypassError = page.locator("p.text-destructive");
      if (await bypassError.isVisible().catch(() => false)) {
        const errorText = (await bypassError.textContent())?.trim();
        throw new Error(
          `Local login failed${errorText ? `: ${errorText}` : ""}. Check /api/dev/auth-bypass and Clerk dev bypass user setup.`,
        );
      }
      await page.waitForTimeout(1500);
      continue;
    }

    const signInButton = page.getByRole("button", { name: "Sign in" });
    if (await signInButton.isVisible().catch(() => false)) {
      throw new Error(
        "The app is on the signed-out landing page but `local login` is unavailable. Capture requires a Next.js dev server (`pnpm dev:web`) on localhost/127.0.0.1.",
      );
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
  prepare?: (page: Page) => Promise<void>,
) {
  await mkdir(captureWebDir, { recursive: true });

  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  if (prepare) {
    await prepare(page);
    await page.waitForLoadState("networkidle");
  }
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

test("capture plan first-day drawer screenshot", async ({ page }) => {
  await ensureSignedIn(page);
  await captureScreen(
    page,
    "/",
    "Weekly Plan",
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
