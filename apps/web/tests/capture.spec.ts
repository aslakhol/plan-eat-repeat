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

    const weeklyPlanHeading = page.getByRole("heading", { name: "Week" });
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

  await expect(page.getByRole("heading", { name: "Week" })).toBeVisible({
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

async function installWakeLockMock(page: Page) {
  await page.addInitScript(() => {
    const state = JSON.parse(
      sessionStorage.getItem("wake-lock-test-state") ??
        '{"requests":0,"releases":0}',
    ) as { requests: number; releases: number };
    const persistState = () =>
      sessionStorage.setItem("wake-lock-test-state", JSON.stringify(state));
    Object.defineProperty(window, "__wakeLockTestState", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => {
          state.requests += 1;
          persistState();
          const sentinel = new EventTarget() as EventTarget & {
            released: boolean;
            release: () => Promise<void>;
          };
          sentinel.released = false;
          sentinel.release = async () => {
            if (sentinel.released) return;
            sentinel.released = true;
            state.releases += 1;
            persistState();
            sentinel.dispatchEvent(new Event("release"));
          };
          return sentinel;
        },
      },
    });
  });
}

async function wakeLockCounts(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __wakeLockTestState: { requests: number; releases: number };
      }
    ).__wakeLockTestState;
    return { ...state };
  });
}

async function openFirstPlannedDinner(page: Page) {
  const dayTriggers = page.getByTestId("plan-day-trigger");

  for (let index = 0; index < (await dayTriggers.count()); index += 1) {
    await dayTriggers.nth(index).click();
    const actions = page.getByText("Planned Dinner actions");
    if (await actions.isVisible().catch(() => false)) return;
    await page.keyboard.press("Escape");
  }

  throw new Error("The capture Household has no planned Dinner this week.");
}

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
    .toEqual({
      requests: 1,
      releases: 0,
    });
  await page.keyboard.press("Escape");
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({
      requests: 1,
      releases: 1,
    });

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
    .toEqual({
      requests: 1,
      releases: 1,
    });
  await page.keyboard.press("Escape");

  await settingsMenu.click();
  await page.getByRole("switch", { name: "Keep screen awake" }).click();
  await page.keyboard.press("Escape");
  await firstDinner.click();
  await expect
    .poll(() => wakeLockCounts(page))
    .toEqual({
      requests: 2,
      releases: 1,
    });

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
      requests: 2,
      releases: 2,
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
      requests: 3,
      releases: 2,
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
      requests: 3,
      releases: 3,
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
  await page.locator('a[href^="/dinners/"]').first().click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
});

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
    await addDinnerButton.click();

    const nameInput = page.getByPlaceholder("What's for dinner?");
    const quickAddButton = page.getByRole("button", {
      name: "Add Name-only Dinner",
    });
    await expect(
      page.getByRole("heading", { name: "Add a dinner" }),
    ).toBeVisible();
    await expect(nameInput).toBeFocused();
    await expect(quickAddButton).toBeDisabled();

    await nameInput.fill(dinnerName);
    await expect(quickAddButton).toBeEnabled();
    await quickAddButton.click();

    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(page.getByRole("heading", { name: dinnerName })).toBeVisible();

    await page.reload();
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(page.getByRole("heading", { name: dinnerName })).toBeVisible();

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
    // Remove the test Dinner through the same public UI so repeated capture
    // runs do not leave fixtures in the Household Cookbook.
    await page.goto("/dinners");
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const createdDinner = page.getByRole("link", { name: dinnerName });
    if (await createdDinner.isVisible().catch(() => false)) {
      await createdDinner.click();
      await page.getByRole("button", { name: "Edit" }).click();
      await page.getByRole("button", { name: "Delete dinner" }).click();
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page).toHaveURL(/\/dinners$/);
    }
  }
});
