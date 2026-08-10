import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

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

const openFirstPlannedDinner = async (page: Page) => {
  const opened = await openFirstPlanDay(page, () =>
    page.getByText("Planned Dinner actions"),
  );
  if (!opened) {
    throw new Error("The capture Household has no planned Dinner this week.");
  }
};

const openFirstEmptyDay = async (page: Page) => {
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
};

async function deleteDinnerFromEditor(page: Page) {
  await page.locator("summary").filter({ hasText: "Editor actions" }).click();
  await page.getByRole("button", { name: "Delete dinner" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
}

async function quickAddDinner(page: Page, dinnerName: string) {
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

async function assertNoHorizontalOverflow(page: Page) {
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

async function deleteDinnerIfPresent(page: Page, dinnerName: string) {
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
    await quickAddDinner(page, dinnerName);

    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();

    await page.reload();
    await expect(page.locator("h1", { hasText: "Cookbook" })).toBeVisible();
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();

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
    await deleteDinnerIfPresent(page, dinnerName);
  }
});

test("empty Plan Slot manual creation saves and opens the planned-day sheet", async ({
  page,
}) => {
  await ensureSignedIn(page);

  const dinnerName = `Planned manual ${Date.now()}`;
  let cleanedUp = false;

  try {
    await openFirstEmptyDay(page);
    await page.getByRole("button", { name: "New dinner" }).click();

    await page.getByPlaceholder("What's for dinner?").fill(dinnerName);
    await page.getByRole("button", { name: "Write it myself" }).click();
    await expect(
      page.getByRole("heading", { name: "New dinner" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      dinnerName,
    );

    await page.getByRole("button", { name: "Save dinner" }).click();

    await expect(page).toHaveURL(/\/?date=\d{4}-\d{2}-\d{2}$/);
    await expect(
      page.locator("h1").filter({ hasText: dinnerName }),
    ).toBeVisible();
    await expect(page.getByText("Planned Dinner actions")).toBeVisible();

    await page
      .locator("summary")
      .filter({ hasText: "Planned Dinner actions" })
      .click();
    await page.getByRole("link", { name: "Edit this Dinner" }).click();
    await deleteDinnerFromEditor(page);
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
    cleanedUp = true;
  } finally {
    if (!cleanedUp) await deleteDinnerIfPresent(page, dinnerName);
  }
});

test("critical Week and Cookbook actions remain reachable across responsive widths", async ({
  page,
}) => {
  await ensureSignedIn(page);

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 480, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Dinner" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.goto("/dinners");
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Dinner" }),
    ).toBeVisible();
    await expect(page.locator('a[href^="/dinners/"]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }

  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await openFirstEmptyDay(page);
  await expect(page.getByRole("button", { name: "New dinner" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Surprise me!" }),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);
});

test("import empty, loading, error, no-match, and missing clipboard states stay recoverable", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await ensureSignedIn(page);

  await page.goto("/dinners");
  const search = page.getByRole("searchbox", { name: "Search dinners" });
  await search.fill(`No match ${Date.now()}`);
  await expect(
    page.getByRole("heading", { name: "No dinners match" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator('a[href^="/dinners/"]').first()).toBeVisible();

  await page.getByRole("button", { name: "Add Dinner" }).click();
  await page.getByRole("button", { name: "Photos" }).click();
  await expect(page.getByText("No photos yet")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose photos" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "‹ Add a dinner" }).click();
  await page.getByRole("button", { name: "Link" }).click();

  const urlInput = page.getByRole("textbox", { name: "Recipe URL" });
  const importButton = page.getByRole("button", { name: "Import recipe" });
  await expect(urlInput).toHaveValue("");
  await expect(importButton).toBeDisabled();
  await urlInput.fill("not-a-url");
  await expect(
    page.getByRole("alert").filter({
      hasText: "Enter a full http or https URL.",
    }),
  ).toBeVisible();

  let releaseImportRequest: () => void = () => undefined;
  const importRequestGate = new Promise<void>((resolve) => {
    releaseImportRequest = resolve;
  });
  await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
    await importRequestGate;
    await route.abort();
  });

  const unreachableUrl = "https://127.0.0.1:1/recipe";
  await urlInput.fill(unreachableUrl);
  await importButton.click();
  await expect(
    page.getByRole("heading", { name: "Reading the recipe" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  releaseImportRequest();
  await expect(urlInput).toHaveValue(unreachableUrl);

  await page.unroute("**/api/trpc/dinner.importFromUrl**");
  await importButton.click();
  await expect(
    page.getByRole("heading", { name: "Couldn't reach the site" }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Write it myself" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(urlInput).toHaveValue(unreachableUrl);
});

test("Cookbook planning, Favourite ordering, and deletion remain coherent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);

  const testRun = Date.now();
  const firstDinnerName = `Issue 131 A ${testRun}`;
  const secondDinnerName = `Issue 131 B ${testRun}`;

  try {
    await quickAddDinner(page, firstDinnerName);
    await page.getByRole("button", { name: "Plan this dinner" }).click();
    const firstFreeDay = page
      .getByRole("button", {
        name: new RegExp(`^Plan ${firstDinnerName} for `),
      })
      .first();
    await expect(firstFreeDay).toBeVisible();
    const plannedDate = (
      await firstFreeDay.getAttribute("aria-label")
    )?.replace(`Plan ${firstDinnerName} for `, "");
    expect(plannedDate).toBeTruthy();
    await firstFreeDay.click();
    await expect(page.getByRole("status")).toContainText(
      `${firstDinnerName} → ${plannedDate}`,
    );
    await expect(page.getByRole("status")).not.toContainText("Undo");

    await quickAddDinner(page, secondDinnerName);
    const dinnerActions = page
      .locator("summary")
      .filter({ hasText: "Dinner actions" });
    await dinnerActions.click();
    await page.getByRole("button", { name: "Add to favourites" }).click();
    await dinnerActions.click();
    await expect(
      page.getByRole("button", { name: "Remove from favourites" }),
    ).toBeVisible();
    await dinnerActions.click();

    await page.getByRole("button", { name: "Plan this dinner" }).click();
    const takenDay = page.getByRole("button", {
      name: `${plannedDate} already has ${firstDinnerName}`,
    });
    await expect(takenDay).toBeVisible();
    await takenDay.click();
    await expect(
      page.getByText(`already has ${firstDinnerName}`),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep it" })).toBeVisible();
    await page.getByRole("button", { name: "Replace" }).click();
    await expect(page.getByRole("status")).toContainText(
      `${secondDinnerName} → ${plannedDate}`,
    );
    await expect(page.getByRole("status")).not.toContainText("Undo");

    await page.getByRole("button", { name: "Favourites" }).click();
    const orderedDinnerNames = await page
      .locator('a[href^="/dinners/"]')
      .allTextContents();
    const firstDinnerIndex = orderedDinnerNames.findIndex((text) =>
      text.includes(firstDinnerName),
    );
    const secondDinnerIndex = orderedDinnerNames.findIndex((text) =>
      text.includes(secondDinnerName),
    );
    expect(firstDinnerIndex).toBeGreaterThanOrEqual(0);
    expect(secondDinnerIndex).toBeGreaterThanOrEqual(0);
    expect(secondDinnerIndex).toBeLessThan(firstDinnerIndex);

    await page.getByRole("link", { name: secondDinnerName }).click();
    await dinnerActions.click();
    await page.getByRole("button", { name: "Delete dinner" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete dinner" });
    await expect(deleteDialog).toContainText("Cooking History");
    await expect(
      deleteDialog.getByText(plannedDate!.replace(/^[^,]+, /, "")),
    ).toBeVisible();
    const confirmDelete = deleteDialog.getByRole("button", {
      name: "Delete",
      exact: true,
    });
    await expect(confirmDelete).toBeEnabled();
    await confirmDelete.click();
    await expect(page).toHaveURL(/\/dinners$/);
    await expect(
      page.getByRole("link", { name: secondDinnerName }),
    ).not.toBeVisible();

    await page.goto("/");
    await expect(page.getByText(secondDinnerName, { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await deleteDinnerIfPresent(page, secondDinnerName);
    await deleteDinnerIfPresent(page, firstDinnerName);
  }
});

test("existing Dinner import keeps conflicts independent and Cancel preserves persisted data", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);

  const testRun = Date.now();
  const originalName = `Issue 131 import ${testRun}`;
  const importedName = `Imported Issue 131 ${testRun}`;
  const originalSourceLink = "https://ours.example/recipe";
  const importedSourceLink = "https://source.example/recipe";
  const mockedImport = JSON.stringify([
    {
      result: {
        data: {
          json: {
            name: importedName,
            recipe: {
              servings: 4,
              parts: [
                {
                  name: null,
                  ingredients: [
                    {
                      name: "Lentils",
                      amount: 200,
                      unit: "g",
                      note: null,
                    },
                  ],
                  steps: ["Cook the lentils."],
                },
              ],
            },
            sourceUrl: importedSourceLink,
          },
        },
      },
    },
  ]);

  try {
    await quickAddDinner(page, originalName);
    await page.getByRole("button", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { name: "Source Link" })
      .fill(originalSourceLink);
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);

    await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: mockedImport,
      });
    });

    const importExistingRecipe = async () => {
      await page.getByRole("button", { name: "Edit" }).click();
      await page
        .locator("summary")
        .filter({ hasText: "Editor actions" })
        .click();
      await page.getByRole("button", { name: "Import a recipe…" }).click();
      await page.getByRole("button", { name: "Link" }).click();
      await page
        .getByRole("textbox", { name: "Recipe URL" })
        .fill(importedSourceLink);
      await page.getByRole("button", { name: "Import recipe" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit dinner" }),
      ).toBeVisible();
    };

    await importExistingRecipe();
    await expect(
      page.getByText(`The source calls it “${importedName}”`),
    ).toBeVisible();
    await expect(
      page.getByText(`The source link is “${importedSourceLink}”`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use theirs" }).first().click();
    await page.getByRole("button", { name: "Keep our link ✓" }).click();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      importedName,
    );
    await expect(
      page.getByRole("textbox", { name: "Source Link" }),
    ).toHaveValue(originalSourceLink);
    await expect(
      page.getByRole("spinbutton", { name: "Number of servings" }),
    ).toHaveValue("4");
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await expect(
      page.locator("h1").filter({ hasText: importedName }),
    ).toBeVisible();

    await importExistingRecipe();
    await expect(
      page.getByRole("button", { name: "Keep our link ✓" }),
    ).toBeVisible();
    page.once("dialog", async (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/dinners$/);

    await page.getByRole("link", { name: importedName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      importedName,
    );
    await expect(
      page.getByRole("textbox", { name: "Source Link" }),
    ).toHaveValue(originalSourceLink);
    await expect(
      page.getByRole("spinbutton", { name: "Number of servings" }),
    ).toHaveValue("4");
  } finally {
    await deleteDinnerIfPresent(page, importedName);
    await deleteDinnerIfPresent(page, originalName);
  }
});
