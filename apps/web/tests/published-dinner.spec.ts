import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";

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
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await quickAddDinner(page, dinnerName);
    await page.getByRole("button", { name: /^(Share|Sharing)$/ }).click();
    await expect(page.getByRole("heading", { name: "Sharing" })).toBeVisible();

    await expect
      .poll(async () => {
        const dinner = await testDb.dinner.findFirst({
          where: { name: dinnerName },
          orderBy: { id: "desc" },
        });
        return dinner?.publishedAt ?? null;
      })
      .not.toBeNull();

    const publishedDinner = await testDb.dinner.findFirstOrThrow({
      where: { name: dinnerName },
      include: { Household: { select: { name: true } } },
      orderBy: { id: "desc" },
    });
    expect(publishedDinner.publicSlug).toBeTruthy();
    expect(publishedDinner.publishedAt).toBeTruthy();
    await testDb.recipePart.create({
      data: {
        dinnerId: publishedDinner.id,
        name: "Sauce",
        order: 0,
        ingredients: {
          create: { order: 0, name: "tomato", amount: 2, unit: null },
        },
        steps: { create: { order: 0, text: "Simmer gently." } },
      },
    });

    await page.getByRole("button", { name: "Copy" }).click();
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

    const response = await anonymousPage.goto(`${publicPath}?save=1`);
    expect(response?.status()).toBe(200);
    const initialHtml = await response!.text();
    expect(initialHtml).toContain(dinnerName);
    const jsonLdMatch = initialHtml.match(
      /<script\b[^>]*\btype="application\/ld\+json"[^>]*>([^<]+)<\/script>/,
    );
    expect(jsonLdMatch).not.toBeNull();
    expect(JSON.parse(jsonLdMatch![1]!)).toMatchObject({
      "@type": "Recipe",
      name: dinnerName,
      author: {
        "@type": "Organization",
        name: publishedDinner.Household.name,
      },
      recipeIngredient: ["2 tomato"],
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Sauce",
          itemListElement: [{ "@type": "HowToStep", text: "Simmer gently." }],
        },
      ],
    });
    await anonymousPage.waitForLoadState("networkidle");
    await expect(
      anonymousPage.locator('link[rel="canonical"]'),
    ).toHaveAttribute("href", copiedLink!);
    await expect(
      anonymousPage.locator('meta[property="og:url"]'),
    ).toHaveAttribute("content", copiedLink!);
    const activeSitemap = await anonymousPage.request.get("/sitemap.xml");
    expect(activeSitemap.status()).toBe(200);
    expect(activeSitemap.headers()["content-type"]).toContain(
      "application/xml",
    );
    expect(await activeSitemap.text()).toContain(`<loc>${copiedLink}</loc>`);
    await expect(
      anonymousPage.getByRole("heading", { name: dinnerName }),
    ).toBeVisible();

    await page.getByRole("button", { name: dinnerName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(updatedDinnerName);
    await page.getByLabel("Notes").fill("Now with live public notes.");
    await page.getByRole("button", { name: "Save dinner" }).click();

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
    await page.getByRole("button", { name: /^(Share|Sharing)$/ }).click();
    await expect(page.getByRole("button", { name: "Share…" })).toHaveCount(0);
    await page
      .getByRole("button", { name: updatedDinnerName, exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await page.getByRole("button", { name: /^(Share|Sharing)$/ }).click();

    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();

    const stoppedResponse = await anonymousPage.goto(publicPath!);
    expect(stoppedResponse?.status()).toBe(404);
    const stoppedHtml = await stoppedResponse!.text();
    expect(stoppedHtml).toContain('name="robots" content="noindex, nofollow"');
    expect(stoppedHtml).not.toContain(updatedDinnerName);
    expect(stoppedHtml).not.toContain(publishedDinner.Household.name);
    const stoppedSitemap = await anonymousPage.request.get("/sitemap.xml");
    expect(stoppedSitemap.status()).toBe(200);
    expect(await stoppedSitemap.text()).not.toContain(
      `<loc>${copiedLink}</loc>`,
    );
    await page.getByRole("button", { name: "Share", exact: true }).click();
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
    const restartedSitemap = await anonymousPage.request.get("/sitemap.xml");
    expect(await restartedSitemap.text()).toContain(
      `<loc>${restartedLink}</loc>`,
    );
    await expect(
      anonymousPage.locator('link[rel="canonical"]'),
    ).toHaveAttribute("href", restartedLink!);
    await expect(
      anonymousPage.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
  } finally {
    try {
      await anonymousContext.close();
    } finally {
      await testDb.dinner.deleteMany({
        where: { name: { in: [dinnerName, updatedDinnerName] } },
      });
    }
  }
});

test("the active Share drawer shows the current distinct-Household Save Count", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceName = `Save Count source ${uniqueId}`;
  const currentUserId = await page.evaluate(
    () =>
      (
        window as typeof window & {
          Clerk: { user: { id: string } };
        }
      ).Clerk.user.id,
  );
  let sourceHouseholdId: string | undefined;
  let destinationHouseholdIds: string[] = [];

  const reopenShareDrawer = async (dinnerId: number) => {
    await page.goto(`/dinners/${dinnerId}`);
    await page.getByRole("button", { name: /^(Share|Sharing)$/ }).click();
    await expect(page.getByRole("heading", { name: "Sharing" })).toBeVisible();
  };
  const expectReopenedSaveCount = async (
    dinnerId: number,
    saveCount: number,
  ) => {
    await reopenShareDrawer(dinnerId);
    if (saveCount === 0) {
      await expect(page.getByText(/^Saved by \d+/)).toHaveCount(0);
      return;
    }
    await expect(
      page.getByText(new RegExp(`^Saved by ${saveCount} (person|people)$`)),
    ).toBeVisible();
  };
  const useHouseholdForMutation = async (
    householdId: string,
    mutation: () => Promise<{ status: number; body: string }>,
  ) => {
    await testDb.membership.update({
      where: { userId: currentUserId },
      data: { householdId },
    });
    try {
      return await mutation();
    } finally {
      if (sourceHouseholdId) {
        await testDb.membership.update({
          where: { userId: currentUserId },
          data: { householdId: sourceHouseholdId },
        });
      }
    }
  };

  try {
    await quickAddDinner(page, sourceName);
    const source = await testDb.dinner.findFirstOrThrow({
      where: { name: sourceName },
      orderBy: { id: "desc" },
    });
    sourceHouseholdId = source.householdId;
    const destinations = await testDb.$transaction(
      ["first", "second"].map((kind) =>
        testDb.household.create({
          data: {
            name: `Save Count ${kind} destination ${uniqueId}`,
            slug: `save-count-${kind}-destination-${uniqueId}`,
          },
        }),
      ),
    );
    destinationHouseholdIds = destinations.map(({ id }) => id);
    const [firstDestination, secondDestination] = destinations;
    expect(firstDestination).toBeTruthy();
    expect(secondDestination).toBeTruthy();

    const copies = await testDb.$transaction([
      testDb.dinner.create({
        data: {
          name: `Source Household copy ${uniqueId}`,
          householdId: source.householdId,
          sourceDinnerId: source.id,
        },
      }),
      testDb.dinner.create({
        data: {
          name: `First destination copy one ${uniqueId}`,
          householdId: firstDestination!.id,
          sourceDinnerId: source.id,
        },
      }),
      testDb.dinner.create({
        data: {
          name: `First destination copy two ${uniqueId}`,
          householdId: firstDestination!.id,
          sourceDinnerId: source.id,
        },
      }),
      testDb.dinner.create({
        data: {
          name: `Second destination copy ${uniqueId}`,
          householdId: secondDestination!.id,
          sourceDinnerId: source.id,
        },
      }),
      testDb.dinner.create({
        data: {
          name: `Second destination kept Dinner ${uniqueId}`,
          householdId: secondDestination!.id,
        },
      }),
    ]);
    const [, firstCopy, secondCopy, mergeDiscardedCopy, mergeKeptDinner] =
      copies;

    await page.getByRole("button", { name: /^(Share|Sharing)$/ }).click();
    await expect(page.getByText(/^Saved by 2 people$/)).toBeVisible();

    const firstDelete = await useHouseholdForMutation(
      firstDestination!.id,
      () => mutateDinner(page, "delete", { dinnerId: firstCopy!.id }),
    );
    expect(firstDelete.status).toBe(200);
    await expectReopenedSaveCount(source.id, 2);

    const lastFirstDestinationDelete = await useHouseholdForMutation(
      firstDestination!.id,
      () => mutateDinner(page, "delete", { dinnerId: secondCopy!.id }),
    );
    expect(lastFirstDestinationDelete.status).toBe(200);
    await expectReopenedSaveCount(source.id, 1);

    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(
      page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText(/^Saved by 1 person$/)).toBeVisible();

    const merge = await useHouseholdForMutation(secondDestination!.id, () =>
      mutateDinner(page, "merge", {
        keptDinnerId: mergeKeptDinner!.id,
        discardedDinnerId: mergeDiscardedCopy!.id,
      }),
    );
    expect(merge.status).toBe(200);
    await expectReopenedSaveCount(source.id, 0);
  } finally {
    if (sourceHouseholdId) {
      await testDb.membership.update({
        where: { userId: currentUserId },
        data: { householdId: sourceHouseholdId },
      });
      await testDb.dinner.deleteMany({
        where: {
          householdId: sourceHouseholdId,
          OR: [
            { name: sourceName },
            { name: `Source Household copy ${uniqueId}` },
          ],
        },
      });
    }
    if (destinationHouseholdIds.length > 0) {
      await testDb.dinner.deleteMany({
        where: { householdId: { in: destinationHouseholdIds } },
      });
      await testDb.household.deleteMany({
        where: { id: { in: destinationHouseholdIds } },
      });
    }
  }
});

test("delete and both Merge Dinner roles keep Published Dinner URLs attached to their Dinner", async ({
  browser,
  page,
}) => {
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const markerName = `Publication lifecycle marker ${uniqueId}`;
  let householdBefore: { id: string; publicSlug: string | null } | undefined;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await quickAddDinner(page, markerName);
    const marker = await testDb.dinner.findFirstOrThrow({
      where: { name: markerName },
      orderBy: { id: "desc" },
    });
    householdBefore = await testDb.household.findUniqueOrThrow({
      where: { id: marker.householdId },
      select: { id: true, publicSlug: true },
    });
    await testDb.household.update({
      where: { id: marker.householdId },
      data: { publicSlug: `publication-lifecycle-${uniqueId}` },
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
    const sitemapAfterDelete = await anonymousPage.request.get("/sitemap.xml");
    expect(await sitemapAfterDelete.text()).not.toContain(
      `<loc>${new URL(
        `/d/${deletedDinner.publicSlug!}`,
        process.env.NEXT_PUBLIC_APP_URL!,
      ).toString()}</loc>`,
    );

    const mergeResult = await mutateDinner(page, "merge", {
      keptDinnerId: publishedKeptDinner.id,
      discardedDinnerId: privateDiscardedDinner.id,
    });
    expect(mergeResult.status).toBe(200);

    const keptResponse = await anonymousPage.goto(
      `/d/${publishedKeptDinner.publicSlug!}`,
    );
    expect(keptResponse?.status()).toBe(200);
    expect(await keptResponse!.text()).not.toContain("application/ld+json");
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
    if (householdBefore) {
      await testDb.household.update({
        where: { id: householdBefore.id },
        data: { publicSlug: householdBefore.publicSlug },
      });
    }
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
