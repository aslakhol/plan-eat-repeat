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

  const settingsLink = page.getByRole("link", {
    name: "Settings",
    exact: true,
  });
  await settingsLink.click();
  await expect(
    page.getByRole("switch", { name: "Keep screen awake" }),
  ).toBeChecked();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();

  await openFirstPlannedDinner(page);
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 0 });
  await page.keyboard.press("Escape");
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 1 });

  await settingsLink.click();
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
  await page.reload();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Keep screen awake" }),
  ).not.toBeChecked();

  await page.getByRole("link", { name: "Cookbook" }).click();
  const firstDinner = page
    .locator('a[href^="/dinners/"]:not([href="/dinners/shared"])')
    .first();
  await expect(firstDinner).toBeVisible();
  await firstDinner.click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({ requests: 1, releases: 1 });
  await page.keyboard.press("Escape");

  await settingsLink.click();
  await page.getByRole("switch", { name: "Keep screen awake" }).click();
  await page.getByRole("link", { name: "Cookbook" }).click();
  await firstDinner.click();
  await expect
    .poll(async () => {
      const { requests, releases } = await wakeLockCounts(page);
      return requests - releases;
    })
    .toBe(1);
  const activeLockCounts = await wakeLockCounts(page);
  expect(activeLockCounts.requests).toBeGreaterThan(1);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({
      requests: activeLockCounts.requests,
      releases: activeLockCounts.releases + 1,
    });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({
      requests: activeLockCounts.requests + 1,
      releases: activeLockCounts.releases + 1,
    });

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
    .toEqual({
      requests: activeLockCounts.requests + 1,
      releases: activeLockCounts.releases + 2,
    });
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
  await page
    .locator('a[href^="/dinners/"]:not([href="/dinners/shared"])')
    .first()
    .click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});
