import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("a long recipe can be read to the end in a mobile drawer", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await page.goto("/dinners");
  await page
    .getByRole("link", { name: /Chicken Curry/ })
    .first()
    .click();
  const dialog = page.getByRole("dialog", { name: "Dinner details" });
  const viewport = dialog.locator("[data-responsive-modal-scroll-viewport]");
  await expect(viewport).toBeVisible();
  const lastStep = dialog.locator("ol li").last();
  await lastStep.scrollIntoViewIfNeeded();
  await expect(lastStep).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});
