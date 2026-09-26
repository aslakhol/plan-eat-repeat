import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

test("returning to the Week keeps a planned Dinner when the refresh lacks authentication", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const date = await page
    .getByTestId("plan-day-trigger")
    .first()
    .getAttribute("data-date");
  const dinner = await db.dinner.create({
    data: {
      name: `Resume dinner ${crypto.randomUUID()}`,
      householdId,
      notes: "Simmer until tender.",
      Plan: { create: { date: new Date(`${date}T00:00:00`) } },
    },
  });
  try {
    await page.reload();
    const plannedDay = page
      .getByTestId("plan-day-trigger")
      .filter({ hasText: dinner.name });
    await expect(plannedDay).toBeVisible();
    await plannedDay.click();
    await expect(page.locator("article")).toContainText(dinner.notes!);
    let failedReads = 0;
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("plan.plannedDinners")) {
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
        failedReads++;
      } else {
        await route.continue();
      }
    });
    const refreshed = page.waitForResponse((response) =>
      response.url().includes("plan.plannedDinners"),
    );
    for (const value of ["hidden", "visible"]) {
      await page.evaluate((value) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value,
        });
        document.dispatchEvent(
          new Event("visibilitychange", { bubbles: true }),
        );
      }, value);
    }
    await refreshed;
    await expect.poll(() => failedReads, { timeout: 15_000 }).toBe(4);
    await expect(page.locator("article")).toContainText(dinner.notes!);
    // Fresh data must arrive again without reloading or closing the recipe.
    await db.dinner.update({
      where: { id: dinner.id },
      data: { notes: "Ready to serve." },
    });
    await page.unrouteAll({ behavior: "wait" });
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange", { bubbles: true }));
    });
    await expect(page.locator("article")).toContainText("Ready to serve.");
    await page.keyboard.press("Escape");
    await expect(plannedDay).toBeVisible();

    // Without any cached week, a failed read must not look like an empty plan.
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("plan.plannedDinners")) {
        await route.abort("failed");
      } else {
        await route.continue();
      }
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("plan-day-trigger")).toHaveCount(0);
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(plannedDay).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: "wait" });
    await db.dinner.delete({ where: { id: dinner.id } });
  }
});
