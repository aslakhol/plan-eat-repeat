import { devices, expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

const { defaultBrowserType: browserName, ...iphone } = devices["iPhone 13"]!;
test.use({ ...iphone, browserName });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
  });
  await ensureSignedIn(page);
});

test("opening the recipe chooser waits for a tap before focusing the dinner name", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Add Dinner", exact: true }).tap();
  const name = page.getByRole("textbox", { name: "Dinner name" });
  await expect(name).toBeVisible();
  // Include the drawer animation and any delayed focus after opening.
  await page.waitForTimeout(600);
  await expect(name).not.toBeFocused();
  await name.tap();
  await expect(name).toBeFocused();
});
