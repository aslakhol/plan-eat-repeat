import { expect, test } from "@playwright/test";

import {
  ensureSignedIn,
  installWakeLockMock,
  openFirstPlannedDinner,
  wakeLockCounts,
} from "./capture-support";

test("the browser-local awake preference controls Week and Cookbook Dinner sheets", async ({
  page,
}) => {
  await installWakeLockMock(page);
  await ensureSignedIn(page);

  const settingsMenu = page.getByRole("button", {
    name: "Open cook settings",
  });
  await expect(settingsMenu).toBeVisible();
  await settingsMenu.click();
  await expect(
    page.getByRole("switch", { name: "Keep screen awake" }),
  ).toBeChecked();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveAttribute(
    "href",
    "/settings",
  );
  await page.keyboard.press("Escape");

  await openFirstPlannedDinner(page);
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 0 });
  await page.keyboard.press("Escape");
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 1 });

  await settingsMenu.click();
  await page.getByRole("switch", { name: "Keep screen awake" }).click();
  await expect(
    page.getByRole("switch", { name: "Keep screen awake" }),
  ).not.toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("plan-eat-repeat:keep-screen-awake"),
      ),
    )
    .toBe("false");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
  await settingsMenu.click();
  await expect(
    page.getByRole("switch", { name: "Keep screen awake" }),
  ).not.toBeChecked();
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: "Cookbook" }).click();
  const firstDinner = page.locator('a[href^="/dinners/"]').first();
  await expect(firstDinner).toBeVisible();
  await firstDinner.click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 1 });
  await page.keyboard.press("Escape");

  await settingsMenu.click();
  await page.getByRole("switch", { name: "Keep screen awake" }).click();
  await page.keyboard.press("Escape");
  await firstDinner.click();
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 2, releases: 1 });

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 2, releases: 2 });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 3, releases: 2 });

  await page.evaluate(() => {
    localStorage.setItem("plan-eat-repeat:keep-screen-awake", "false");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "plan-eat-repeat:keep-screen-awake",
        newValue: "false",
      }),
    );
  });
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 3, releases: 3 });
});

test("denied wake lock does not block Dinner viewing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: () =>
          Promise.reject(new DOMException("Denied", "NotAllowedError")),
      },
    });
  });
  await ensureSignedIn(page);
  await page.getByRole("link", { name: "Cookbook" }).click();
  await page.locator('a[href^="/dinners/"]').first().click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});
