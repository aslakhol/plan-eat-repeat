import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

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

const mutateDinner = (
  page: Page,
  procedure: "publish" | "stopPublication" | "delete" | "merge",
  input: Record<string, number>,
) =>
  page.evaluate(
    async ({ procedure, input }) => {
      const result = await fetch(`/api/trpc/dinner.${procedure}?batch=1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 0: { json: input } }),
      });
      return { status: result.status, body: await result.text() };
    },
    { procedure, input },
  );

test("a Cookbook member publishes a Dinner that anyone can read", async ({
  browser,
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("published-dinner-copied-link", value);
        },
      },
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        sessionStorage.setItem(
          "published-dinner-share-data",
          JSON.stringify(data),
        );
      },
    });
  });
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

    const publishedDinner = await testDb.dinner.findFirstOrThrow({
      where: { name: dinnerName },
      include: { Household: { select: { name: true } } },
      orderBy: { id: "desc" },
    });
    expect(publishedDinner.publicSlug).toBeTruthy();
    expect(publishedDinner.publishedAt).toBeTruthy();

    await page.getByRole("button", { name: "Copy" }).click();
    await expect(page.getByText("Copied link", { exact: true })).toBeVisible();
    const copiedLink = await page.evaluate(() =>
      sessionStorage.getItem("published-dinner-copied-link"),
    );
    const publicPath = new URL(copiedLink!).pathname;
    expect(publicPath).toMatch(/^\/d\/[a-z0-9-]+$/);

    await page.getByRole("button", { name: "Share…" }).click();
    const shareData = await page.evaluate(() =>
      JSON.parse(
        sessionStorage.getItem("published-dinner-share-data") ?? "null",
      ),
    );
    expect(shareData).toEqual({ title: dinnerName, url: copiedLink });
    await expect(
      page.getByText(/^Shared since \d{1,2} [A-Z][a-z]+$/),
    ).toBeVisible();
    await expect(page.getByText(/Opened \d+ times/)).toHaveCount(0);

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

    await page.goto(`/dinners/${publishedDinner.id}`);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: undefined,
      });
    });
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("button", { name: "Share…" })).toHaveCount(0);
    await page
      .getByRole("button", { name: updatedDinnerName, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Share" }).click();

    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(
      page.getByRole("button", { name: "Publish dinner" }),
    ).toBeVisible();
    await expect(
      page.getByText("Sharing stopped", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Undo" })).toHaveCount(0);

    const stoppedResponse = await anonymousPage.goto(publicPath!);
    expect(stoppedResponse?.status()).toBe(404);
    const stoppedHtml = await stoppedResponse!.text();
    expect(stoppedHtml).toContain("This dinner is no longer shared");
    expect(stoppedHtml).toContain('name="robots" content="noindex, nofollow"');
    expect(stoppedHtml).not.toContain(updatedDinnerName);
    expect(stoppedHtml).not.toContain(publishedDinner.Household.name);
    await expect(
      anonymousPage.getByRole("heading", {
        name: "This dinner is no longer shared",
      }),
    ).toBeVisible();

    await page.waitForTimeout(20);
    await page.getByRole("button", { name: "Publish dinner" }).click();
    await page.getByRole("button", { name: "Copy" }).click();
    const restartedLink = await page.evaluate(() =>
      sessionStorage.getItem("published-dinner-copied-link"),
    );
    expect(new URL(restartedLink!).pathname).toBe(publicPath);
    const restartedDinner = await testDb.dinner.findUniqueOrThrow({
      where: { id: publishedDinner.id },
    });
    expect(restartedDinner.publishedAt!.getTime()).toBeGreaterThan(
      publishedDinner.publishedAt!.getTime(),
    );

    const restartedResponse = await anonymousPage.goto(publicPath!);
    expect(restartedResponse?.status()).toBe(200);
    await expect(
      anonymousPage.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
  } finally {
    await anonymousContext.close();
    await deleteDinnerIfPresent(page, cleanupName);
  }
});

test("publication APIs cannot change another Household's Dinner", async ({
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
    const response = await mutateDinner(page, "publish", {
      dinnerId: foreignDinner.id,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.body).toContain('"code":"NOT_FOUND"');

    const stopResponse = await mutateDinner(page, "stopPublication", {
      dinnerId: foreignDinner.id,
    });

    expect(stopResponse.status).toBeGreaterThanOrEqual(400);
    expect(stopResponse.body).toContain('"code":"NOT_FOUND"');
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

test("delete and both Merge Dinner roles keep Published Dinner URLs attached to their Dinner", async ({
  browser,
  page,
}) => {
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const markerName = `Publication lifecycle marker ${uniqueId}`;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await quickAddDinner(page, markerName);
    const marker = await testDb.dinner.findFirstOrThrow({
      where: { name: markerName },
      orderBy: { id: "desc" },
    });
    const created = await testDb.$transaction([
      testDb.dinner.create({
        data: {
          householdId: marker.householdId,
          name: `Dinner deleted ${uniqueId}`,
          publicSlug: `dinner-deleted-${uniqueId}`,
          publishedAt: new Date(),
        },
      }),
      testDb.dinner.create({
        data: {
          householdId: marker.householdId,
          name: `Published Dinner kept ${uniqueId}`,
          publicSlug: `published-dinner-kept-${uniqueId}`,
          publishedAt: new Date(),
        },
      }),
      testDb.dinner.create({
        data: {
          householdId: marker.householdId,
          name: `Private Dinner discarded ${uniqueId}`,
        },
      }),
      testDb.dinner.create({
        data: {
          householdId: marker.householdId,
          name: `Private Dinner kept ${uniqueId}`,
        },
      }),
      testDb.dinner.create({
        data: {
          householdId: marker.householdId,
          name: `Published Dinner discarded ${uniqueId}`,
          publicSlug: `published-dinner-discarded-${uniqueId}`,
          publishedAt: new Date(),
        },
      }),
    ]);
    const [
      deletedDinner,
      publishedKeptDinner,
      privateDiscardedDinner,
      privateKeptDinner,
      publishedDiscardedDinner,
    ] = created;

    const deleteResult = await mutateDinner(page, "delete", {
      dinnerId: deletedDinner.id,
    });
    expect(deleteResult.status).toBe(200);
    const deletedResponse = await anonymousPage.goto(
      `/d/${deletedDinner.publicSlug!}`,
    );
    expect(deletedResponse?.status()).toBe(404);

    const mergeResult = await mutateDinner(page, "merge", {
      keptDinnerId: publishedKeptDinner.id,
      discardedDinnerId: privateDiscardedDinner.id,
    });
    expect(mergeResult.status).toBe(200);

    const keptResponse = await anonymousPage.goto(
      `/d/${publishedKeptDinner.publicSlug!}`,
    );
    expect(keptResponse?.status()).toBe(200);
    await expect(
      anonymousPage.getByRole("heading", { name: publishedKeptDinner.name }),
    ).toBeVisible();

    const discardPublishedResult = await mutateDinner(page, "merge", {
      keptDinnerId: privateKeptDinner.id,
      discardedDinnerId: publishedDiscardedDinner.id,
    });
    expect(discardPublishedResult.status).toBe(200);

    const discardedResponse = await anonymousPage.goto(
      `/d/${publishedDiscardedDinner.publicSlug!}`,
    );
    expect(discardedResponse?.status()).toBe(404);
    expect(await discardedResponse!.text()).not.toContain(
      publishedDiscardedDinner.name,
    );

    await expect
      .poll(() =>
        testDb.dinner.findUnique({ where: { id: publishedKeptDinner.id } }),
      )
      .toMatchObject({ publicSlug: publishedKeptDinner.publicSlug });
    await expect
      .poll(() =>
        testDb.dinner.findUnique({ where: { id: privateKeptDinner.id } }),
      )
      .toMatchObject({ publicSlug: null, publishedAt: null });
    expect(
      await testDb.dinner.findUnique({
        where: { id: publishedDiscardedDinner.id },
      }),
    ).toBeNull();
  } finally {
    await anonymousContext.close();
    await testDb.dinner.deleteMany({
      where: {
        name: {
          in: [
            `Dinner deleted ${uniqueId}`,
            `Published Dinner kept ${uniqueId}`,
            `Private Dinner discarded ${uniqueId}`,
            `Private Dinner kept ${uniqueId}`,
            `Published Dinner discarded ${uniqueId}`,
          ],
        },
      },
    });
    await deleteDinnerIfPresent(page, markerName);
  }
});
