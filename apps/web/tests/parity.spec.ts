import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const parityWebDir = path.resolve(currentDir, "../../../parity/web");

async function captureScreen(
  page: Page,
  pagePath: string,
  heading: string,
  outputFileName: string,
) {
  await mkdir(parityWebDir, { recursive: true });

  await page.goto(pagePath, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: heading })).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(parityWebDir, outputFileName),
    fullPage: true,
    type: "png",
  });
}

test("capture parity plan screenshot", async ({ page }) => {
  await captureScreen(page, "/parity/plan", "Weekly Plan", "plan.png");
});

test("capture parity dinners screenshot", async ({ page }) => {
  await captureScreen(page, "/parity/dinners", "Dinners", "dinners.png");
});
