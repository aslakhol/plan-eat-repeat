import { expect, test, type Page } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

async function visibility(page: Page, value: "hidden" | "visible") {
  await page.evaluate((value) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value,
    });
    document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
  }, value);
}

for (const failure of ["network", "authentication"] as const) {
  test(`returning to a Dinner keeps its recipe and Cookbook after ${failure} fails`, async ({
    page,
  }) => {
    await ensureSignedIn(page);
    await page.goto("/dinners");
    const dinnerLink = page
      .locator('a[href^="/dinners/"]:not([href="/dinners/shared"])')
      .first();
    await expect(dinnerLink).toBeVisible();
    const href = await dinnerLink.getAttribute("href");
    await dinnerLink.click();
    const recipe = page.locator("article");
    await expect(recipe).toBeVisible();
    const recipeText = await recipe.innerText();

    await visibility(page, "hidden");
    // Cookbook summaries stay fresh for 30 seconds.
    await page.clock.setFixedTime(new Date(Date.now() + 31_000));
    let failedReads = 0;
    let failedSummaries = 0;
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().method() === "GET") {
        if (route.request().url().includes("dinner.get")) failedReads++;
        if (route.request().url().includes("dinner.summaries"))
          failedSummaries++;
        if (failure === "network") {
          await route.abort("failed");
        } else {
          const response = await route.fetch({
            headers: {
              ...route.request().headers(),
              cookie: "",
              authorization: "",
            },
          });
          await route.fulfill({
            status: response.status(),
            contentType: "application/json",
            body: await response.body(),
          });
        }
      } else {
        await route.continue();
      }
    });
    await visibility(page, "visible");
    // The initial refresh and all three retries must fail before checking content.
    await expect.poll(() => failedReads, { timeout: 15_000 }).toBe(4);
    await expect.poll(() => failedSummaries, { timeout: 15_000 }).toBe(4);
    await expect(recipe).toBeVisible();
    await expect(recipe).toHaveText(recipeText, { useInnerText: true });
    await page.keyboard.press("Escape");
    await expect(page.locator(`a[href="${href}"]`)).toBeVisible();

    // Returning again with a working connection recovers without a page reload.
    await page.unrouteAll({ behavior: "wait" });
    await visibility(page, "hidden");
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().includes("dinner.summaries") && response.ok(),
    );
    await visibility(page, "visible");
    await refreshed;
    await page.locator(`a[href="${href}"]`).click();
    await expect(recipe).toHaveText(recipeText, { useInnerText: true });
  });
}

test("a Dinner that has never loaded still offers retry after a failed request", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await page.goto("/dinners");
  const dinnerLink = page
    .locator('a[href^="/dinners/"]:not([href="/dinners/shared"])')
    .first();
  await expect(dinnerLink).toBeVisible();
  await page.route("**/api/trpc/**", async (route) => {
    if (route.request().url().includes("dinner.get")) {
      await route.abort("failed");
    } else {
      await route.continue();
    }
  });
  await dinnerLink.click();
  await expect(
    page.getByRole("heading", { name: "Couldn't load this Dinner" }),
  ).toBeVisible({ timeout: 15_000 });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("article")).toBeVisible();
});
