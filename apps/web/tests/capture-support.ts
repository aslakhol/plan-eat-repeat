import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { expect, type Locator, type Page } from "@playwright/test";

import type { PrismaClient } from "@planeatrepeat/db";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);
const captureWebDir = path.resolve(currentDir, "../../../capture/web");

export async function ensureSignedIn(page: Page) {
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
    if (await weeklyPlanHeading.isVisible().catch(() => false)) return;

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

    if (
      await page
        .getByRole("button", { name: "Sign in" })
        .isVisible()
        .catch(() => false)
    ) {
      throw new Error(
        "The app is on the signed-out landing page but `local login` is unavailable. Capture requires a Next.js dev server (`pnpm dev:web`) on localhost/127.0.0.1.",
      );
    }
  }

  await expect(page.getByRole("heading", { name: "Week" })).toBeVisible({
    timeout: 30_000,
  });
}

export type LocalAuthIdentity =
  | "save-intent-existing"
  | "save-intent-first-time";

export async function provisionLocalAuth(
  page: Page,
  identity: LocalAuthIdentity,
) {
  const response = await page.request.post("/api/dev/auth-bypass", {
    data: { identity },
  });
  const payload = (await response.json()) as {
    ticket?: string;
    userId?: string;
    error?: string;
  };
  if (!response.ok() || !payload.ticket || !payload.userId) {
    throw new Error(payload.error ?? "Failed to provision local auth");
  }
  return { ticket: payload.ticket, userId: payload.userId };
}

export async function completeLocalAuth(
  page: Page,
  ticket: string,
  returnPath: string,
) {
  await page.evaluate(
    async ({ ticket, returnPath }) => {
      const clerk = (
        window as typeof window & {
          Clerk: {
            client: {
              signIn: {
                create: (input: {
                  strategy: "ticket";
                  ticket: string;
                }) => Promise<{ createdSessionId: string | null }>;
              };
            };
            setActive: (input: { session: string }) => Promise<void>;
          };
        }
      ).Clerk;
      const attempt = await clerk.client.signIn.create({
        strategy: "ticket",
        ticket,
      });
      if (!attempt.createdSessionId) {
        throw new Error("Local auth did not create a Clerk session");
      }
      await clerk.setActive({ session: attempt.createdSessionId });
      window.location.assign(returnPath);
    },
    { ticket, returnPath },
  );
}

export async function resetLocalIdentity(testDb: PrismaClient, userId: string) {
  const membership = await testDb.membership.findUnique({
    where: { userId },
    select: { householdId: true },
  });
  if (membership) {
    await testDb.dinner.deleteMany({
      where: { householdId: membership.householdId },
    });
    await testDb.household.delete({ where: { id: membership.householdId } });
  }
  await testDb.user.deleteMany({ where: { id: userId } });
}

export async function captureScreen(
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

export async function installWakeLockMock(page: Page) {
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

export async function wakeLockCounts(page: Page) {
  return page.evaluate(() => {
    const state = (
      window as typeof window & {
        __wakeLockTestState: { requests: number; releases: number };
      }
    ).__wakeLockTestState;
    return { ...state };
  });
}

async function openFirstPlanDay(page: Page, expectedSurface: () => Locator) {
  const dayTriggers = page.getByTestId("plan-day-trigger");
  for (let index = 0; index < (await dayTriggers.count()); index += 1) {
    await dayTriggers.nth(index).click();
    if (
      await expectedSurface()
        .isVisible()
        .catch(() => false)
    )
      return true;
    await page.keyboard.press("Escape");
  }
  return false;
}

export async function openFirstPlannedDinner(page: Page) {
  const opened = await openFirstPlanDay(page, () =>
    page.getByText("Planned Dinner actions"),
  );
  if (!opened) {
    throw new Error("The capture Household has no planned Dinner this week.");
  }
}

export async function openFirstEmptyDay(page: Page) {
  for (let week = 0; week < 4; week += 1) {
    const opened = await openFirstPlanDay(page, () =>
      page.getByRole("dialog", { name: "Choose a Dinner" }),
    );
    if (opened) return;
    await page.getByRole("button", { name: "Next week" }).click();
    await page.waitForLoadState("networkidle");
  }
  throw new Error(
    "The capture Household has no empty Plan Slot in four weeks.",
  );
}

export async function deleteDinnerFromEditor(page: Page) {
  await page.locator("summary").filter({ hasText: "Editor actions" }).click();
  await page.getByRole("button", { name: "Delete dinner" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
}

export async function quickAddDinner(page: Page, dinnerName: string) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
  await page.getByRole("button", { name: "Add Dinner" }).click();
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
  await expect(
    page.locator("h1").filter({ hasText: dinnerName }),
  ).toBeVisible();
}

export async function assertNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Math.max(
            document.body.scrollWidth,
            document.documentElement.scrollWidth,
          ) <= window.innerWidth,
      ),
    )
    .toBe(true);
}

export async function deleteDinnerIfPresent(page: Page, dinnerName: string) {
  await page.goto("/dinners");
  await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForLoadState("networkidle");
  const dinnerLink = page
    .locator('a[href^="/dinners/"]')
    .filter({ hasText: dinnerName })
    .first();
  if ((await dinnerLink.count()) === 0) return;
  await dinnerLink.click();
  await page.getByRole("button", { name: "Edit" }).click();
  await deleteDinnerFromEditor(page);
  await expect(page).toHaveURL(/\/dinners$/);
}
