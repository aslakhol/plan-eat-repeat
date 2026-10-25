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

test("link import reads the clipboard only after tapping Paste and preserves the URL if denied", async ({
  page,
}) => {
  let clipboardReads = 0;
  await page.exposeFunction("readClipboard", () => {
    clipboardReads += 1;
    if (clipboardReads > 1) throw new Error("Clipboard permission denied");
    return "https://example.com/clipboard-recipe";
  });
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: () =>
          (
            window as typeof window & {
              readClipboard: () => Promise<string>;
            }
          ).readClipboard(),
      },
    });
  });
  await page.getByRole("button", { name: "Add Dinner", exact: true }).tap();
  await page.getByRole("button", { name: "Link", exact: true }).tap();
  const url = page.getByRole("textbox", { name: "Recipe URL" });
  await expect(url).toBeVisible();
  await url.tap();
  await expect(url).toBeFocused();
  expect(clipboardReads).toBe(0);
  await page.keyboard.type("https://example.com/recipe");
  await expect(url).toHaveValue("https://example.com/recipe");
  await expect(
    page.getByRole("button", { name: "Import recipe", exact: true }),
  ).toBeEnabled();
  const paste = page.getByRole("button", { name: "Paste", exact: true });
  await paste.tap();
  await expect(url).toHaveValue("https://example.com/clipboard-recipe");
  expect(clipboardReads).toBe(1);
  await paste.tap();
  await expect(
    page.getByText("Could not paste link", { exact: true }),
  ).toBeVisible();
  await expect(url).toHaveValue("https://example.com/clipboard-recipe");
});
