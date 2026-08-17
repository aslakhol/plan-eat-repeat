import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const testDb = createPrismaClient(databaseUrl);

test.afterAll(async () => testDb.$disconnect());

test("a Cookbook member publishes a Dinner that anyone can read", async ({
  browser,
  page,
}) => {
  await ensureSignedIn(page);
  const dinnerName = `Published Dinner ${Date.now()}`;
  const updatedDinnerName = `${dinnerName} updated`;
  let cleanupName = dinnerName;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await quickAddDinner(page, dinnerName);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(
      page.getByRole("heading", { name: "Share dinner" }),
    ).toBeVisible();
    await expect(page.getByText("Anyone can read this dinner.")).toBeVisible();
    await page.getByRole("button", { name: "Publish dinner" }).click();

    const publicLink = page.getByRole("link", {
      name: "Open published dinner",
    });
    const publicPath = await publicLink.getAttribute("href");
    expect(publicPath).toMatch(/^\/d\/[a-z0-9-]+$/);

    const response = await anonymousPage.goto(publicPath!);
    expect(response?.status()).toBe(200);
    expect(await response?.text()).toContain(dinnerName);
    await expect(
      anonymousPage.getByRole("heading", { name: dinnerName }),
    ).toBeVisible();
    await expect(
      anonymousPage.getByText(/Shared by .+ · \d{1,2} [A-Z][a-z]+/),
    ).toBeVisible();
    await expect(
      anonymousPage.getByRole("link", { name: "Cookbook" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: dinnerName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(updatedDinnerName);
    await page.getByLabel("Notes").fill("Now with live public notes.");
    await page.getByRole("button", { name: "Save dinner" }).click();
    cleanupName = updatedDinnerName;

    await anonymousPage.reload();
    await expect(
      anonymousPage.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await expect(
      anonymousPage.getByText("Now with live public notes."),
    ).toBeVisible();
    expect(new URL(anonymousPage.url()).pathname).toBe(publicPath);

    await page.goto(publicPath!);
    await expect(
      page.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Cookbook" })).toHaveCount(0);
  } finally {
    await anonymousContext.close();
    await deleteDinnerIfPresent(page, cleanupName);
  }
});

test("the publish API cannot expose another Household's Dinner", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const foreignHousehold = await testDb.household.create({
    data: {
      name: "Foreign Household",
      slug: `foreign-household-${uniqueId}`,
      Dinners: { create: { name: "Foreign private Dinner" } },
    },
    include: { Dinners: true },
  });
  const foreignDinner = foreignHousehold.Dinners[0];
  if (!foreignDinner) throw new Error("Foreign Dinner was not created");

  try {
    const response = await page.evaluate(async (dinnerId) => {
      const result = await fetch("/api/trpc/dinner.publish?batch=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 0: { json: { dinnerId } } }),
      });
      return { status: result.status, body: await result.text() };
    }, foreignDinner.id);

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toContain('"code":"NOT_FOUND"');
    await expect
      .poll(async () =>
        testDb.dinner.findUnique({ where: { id: foreignDinner.id } }),
      )
      .toMatchObject({ publicSlug: null, publishedAt: null });
  } finally {
    await testDb.dinner.deleteMany({
      where: { householdId: foreignHousehold.id },
    });
    await testDb.household.delete({ where: { id: foreignHousehold.id } });
  }
});
