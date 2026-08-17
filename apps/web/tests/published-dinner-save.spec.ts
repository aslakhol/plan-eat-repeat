import { addDays, startOfDay, startOfISOWeek } from "date-fns";
import { createRequire } from "node:module";
import { expect, test, type Page } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";

import { ensureSignedIn, quickAddDinner } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const testDb = createPrismaClient(databaseUrl);

test.afterAll(async () => testDb.$disconnect());

const savePublishedDinner = (
  page: Page,
  publicSlug: string,
  forceCopy = false,
) =>
  page.evaluate(
    async ({ publicSlug, forceCopy }) => {
      const response = await fetch("/api/trpc/dinner.savePublished?batch=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          0: { json: { publicSlug, ...(forceCopy ? { forceCopy } : {}) } },
        }),
      });
      return { status: response.status, body: await response.text() };
    },
    { publicSlug, forceCopy },
  );

const publishedDinnerAction = (page: Page, name: string) =>
  page.getByRole("article").getByRole("button", { name });

test("a signed-in Household saves, revisits, copies, plans, and keeps a detached Published Dinner", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const markerName = `Save journey marker ${uniqueId}`;
  const destinationTagDinnerName = `Destination tags ${uniqueId}`;
  const sourceName = `Detached curry ${uniqueId}`;
  const sourceHouseholdName = `Source Household ${uniqueId}`;
  const ownSourceName = `Own published Dinner ${uniqueId}`;
  const publicSlug = `detached-curry-${uniqueId}`;
  const ownPublicSlug = `own-published-dinner-${uniqueId}`;
  const currentWeekStart = startOfISOWeek(startOfDay(new Date()));
  let sourceDinnerId: number | undefined;
  let sourceHouseholdId: string | undefined;
  let destinationHouseholdId: string | undefined;

  try {
    await quickAddDinner(page, markerName);
    const marker = await testDb.dinner.findFirstOrThrow({
      where: { name: markerName },
      orderBy: { id: "desc" },
    });
    destinationHouseholdId = marker.householdId;
    const currentWeekPlans = await testDb.plan.findMany({
      where: {
        date: { gte: currentWeekStart, lt: addDays(currentWeekStart, 7) },
        dinner: { householdId: destinationHouseholdId },
      },
      select: { date: true },
    });
    const occupiedDate = Array.from({ length: 7 }, (_, index) =>
      addDays(currentWeekStart, index),
    ).find(
      (date) =>
        !currentWeekPlans.some((plan) => plan.date.getTime() === date.getTime()),
    );
    if (!occupiedDate) throw new Error("The current week has no free Plan Slot");

    const destinationTagDinner = await testDb.dinner.create({
      data: {
        name: destinationTagDinnerName,
        householdId: destinationHouseholdId,
        tags: {
          connectOrCreate: [
            { where: { value: "Quick" }, create: { value: "Quick" } },
            {
              where: { value: "Weeknight" },
              create: { value: "Weeknight" },
            },
          ],
        },
      },
    });
    await testDb.plan.create({
      data: { dinnerId: destinationTagDinner.id, date: occupiedDate },
    });

    const sourceHousehold = await testDb.household.create({
      data: {
        name: sourceHouseholdName,
        slug: `source-household-${uniqueId}`,
      },
    });
    sourceHouseholdId = sourceHousehold.id;
    const source = await testDb.dinner.create({
      data: {
        name: sourceName,
        householdId: sourceHousehold.id,
        publicSlug,
        publishedAt: new Date(),
        favourite: true,
        link: "https://example.com/detached-curry",
        notes: "Double the ginger.",
        servings: 4,
        tags: {
          connectOrCreate: [
            { where: { value: "quick" }, create: { value: "quick" } },
            {
              where: { value: `Unfamiliar ${uniqueId}` },
              create: { value: `Unfamiliar ${uniqueId}` },
            },
          ],
        },
        parts: {
          create: {
            name: "Curry",
            order: 0,
            ingredients: {
              create: {
                order: 0,
                name: "ginger",
                amount: 2,
                unit: "tbsp",
                note: "grated",
              },
            },
            steps: {
              create: { order: 0, text: "Fry until fragrant." },
            },
          },
        },
        Plan: { create: { date: addDays(occupiedDate, -7) } },
      },
    });
    sourceDinnerId = source.id;
    const tagCountBeforeSave = await testDb.tag.count();

    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page, "Add to my cookbook").click();
    const saveResult = page.getByRole("dialog", {
      name: "Saved to your cookbook",
    });
    await expect(saveResult).toBeVisible();

    const copiesAfterSave = await testDb.dinner.findMany({
      where: { householdId: destinationHouseholdId, sourceDinnerId: source.id },
      include: {
        tags: { orderBy: { value: "asc" } },
        Plan: true,
        parts: {
          orderBy: { order: "asc" },
          include: {
            ingredients: { orderBy: { order: "asc" } },
            steps: { orderBy: { order: "asc" } },
          },
        },
      },
    });
    expect(copiesAfterSave).toHaveLength(1);
    const firstCopy = copiesAfterSave[0]!;
    expect(firstCopy).toMatchObject({
      name: sourceName,
      link: "https://example.com/detached-curry",
      notes: "Double the ginger.",
      servings: 4,
      favourite: false,
      publicSlug: null,
      publishedAt: null,
      sourceDinnerId: source.id,
      Plan: [],
    });
    expect(firstCopy.createdAt.getTime()).toBeGreaterThan(
      source.createdAt.getTime(),
    );
    expect(firstCopy.tags.map((tag) => tag.value)).toEqual(["Quick"]);
    expect(firstCopy.parts).toHaveLength(1);
    expect(firstCopy.parts[0]!.ingredients[0]).toMatchObject({
      name: "ginger",
      amount: 2,
      unit: "tbsp",
      note: "grated",
    });
    expect(firstCopy.parts[0]!.steps[0]?.text).toBe("Fry until fragrant.");
    expect(await testDb.tag.count()).toBe(tagCountBeforeSave);

    expect((await savePublishedDinner(page, publicSlug)).status).toBe(200);
    expect((await savePublishedDinner(page, publicSlug)).status).toBe(200);
    expect(
      await testDb.dinner.count({
        where: {
          householdId: destinationHouseholdId,
          sourceDinnerId: source.id,
        },
      }),
    ).toBe(1);

    await page.reload();
    await expect(
      publishedDinnerAction(page, "Already in your cookbook"),
    ).toBeVisible();
    await publishedDinnerAction(page, "Already in your cookbook").click();
    const alreadySaved = page.getByRole("dialog", {
      name: "Already in your cookbook",
    });
    await alreadySaved.getByRole("link", { name: "Open it" }).click();
    await expect(page).toHaveURL(new RegExp(`/dinners/${firstCopy.id}$`));

    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page, "Already in your cookbook").click();
    await page
      .getByRole("dialog", { name: "Already in your cookbook" })
      .getByRole("button", { name: "Save a copy" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Saved to your cookbook" }),
    ).toBeVisible();
    const deliberateCopies = await testDb.dinner.findMany({
      where: { householdId: destinationHouseholdId, sourceDinnerId: source.id },
      orderBy: { id: "asc" },
    });
    expect(deliberateCopies).toHaveLength(2);
    const plannedCopy = deliberateCopies[1]!;

    await page
      .getByRole("dialog", { name: "Saved to your cookbook" })
      .getByRole("button", { name: "Plan it" })
      .click();
    const occupiedDay = page.getByRole("button", {
      name: new RegExp(`already has ${destinationTagDinnerName}$`),
    });
    await occupiedDay.click();
    await expect(page.getByRole("button", { name: "Keep it" })).toBeVisible();
    await page.getByRole("button", { name: "Replace" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect
      .poll(async () =>
        testDb.plan.findFirst({
          where: {
            date: occupiedDate,
            dinner: { householdId: destinationHouseholdId },
          },
          select: { dinnerId: true },
        }),
      )
      .toEqual({ dinnerId: plannedCopy.id });

    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page, "Already in your cookbook").click();
    await page
      .getByRole("dialog", { name: "Already in your cookbook" })
      .getByRole("button", { name: "Save a copy" })
      .click();
    await page
      .getByRole("dialog", { name: "Saved to your cookbook" })
      .getByRole("link", { name: "Open my cookbook" })
      .click();
    await expect(page).toHaveURL(/\/dinners$/);

    await testDb.dinner.delete({ where: { id: source.id } });
    await page.goto(`/dinners/${firstCopy.id}`);
    await expect(page.getByRole("heading", { name: sourceName })).toBeVisible();
    await expect(page.getByText(sourceHouseholdName)).toHaveCount(0);
    expect(
      await testDb.dinner.findUnique({ where: { id: firstCopy.id } }),
    ).toMatchObject({ sourceDinnerId: source.id, name: sourceName });

    const ownSource = await testDb.dinner.create({
      data: {
        name: ownSourceName,
        householdId: destinationHouseholdId,
        publicSlug: ownPublicSlug,
        publishedAt: new Date(),
      },
    });
    await page.goto(`/d/${ownPublicSlug}`);
    await expect(
      publishedDinnerAction(page, "Already in your cookbook"),
    ).toBeVisible();
    expect((await savePublishedDinner(page, ownPublicSlug)).status).toBe(200);
    expect(
      await testDb.dinner.count({
        where: {
          householdId: destinationHouseholdId,
          sourceDinnerId: ownSource.id,
        },
      }),
    ).toBe(0);
    await publishedDinnerAction(page, "Already in your cookbook").click();
    await page
      .getByRole("dialog", { name: "Already in your cookbook" })
      .getByRole("link", { name: "Open it" })
      .click();
    await expect(page).toHaveURL(new RegExp(`/dinners/${ownSource.id}$`));
  } finally {
    if (destinationHouseholdId) {
      await testDb.dinner.deleteMany({
        where: {
          householdId: destinationHouseholdId,
          OR: [
            ...(sourceDinnerId ? [{ sourceDinnerId }] : []),
            {
              name: {
                in: [markerName, destinationTagDinnerName, ownSourceName],
              },
            },
          ],
        },
      });
    }
    if (sourceDinnerId) {
      await testDb.dinner.deleteMany({ where: { id: sourceDinnerId } });
    }
    if (sourceHouseholdId) {
      await testDb.household.deleteMany({ where: { id: sourceHouseholdId } });
    }
  }
});

test("concurrent saves across different sources respect the Household burst limit", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const markerName = `Save burst marker ${uniqueId}`;
  const publicSlugs = Array.from(
    { length: 21 },
    (_, index) => `save-burst-${uniqueId}-${index}`,
  );
  let destinationHouseholdId: string | undefined;
  let sourceHouseholdId: string | undefined;
  let sourceDinnerIds: number[] = [];

  try {
    await quickAddDinner(page, markerName);
    const marker = await testDb.dinner.findFirstOrThrow({
      where: { name: markerName },
      orderBy: { id: "desc" },
    });
    destinationHouseholdId = marker.householdId;
    const sourceHousehold = await testDb.household.create({
      data: {
        name: `Save Burst Sources ${uniqueId}`,
        slug: `save-burst-sources-${uniqueId}`,
      },
    });
    sourceHouseholdId = sourceHousehold.id;
    await testDb.dinner.createMany({
      data: publicSlugs.map((publicSlug, index) => ({
        name: `Save burst Dinner ${uniqueId} ${index}`,
        householdId: sourceHousehold.id,
        publicSlug,
        publishedAt: new Date(),
      })),
    });
    sourceDinnerIds = (
      await testDb.dinner.findMany({
        where: { publicSlug: { in: publicSlugs } },
        select: { id: true },
      })
    ).map((dinner) => dinner.id);

    const statuses = await page.evaluate(async (slugs) => {
      return Promise.all(
        slugs.map(async (publicSlug) => {
          const response = await fetch(
            "/api/trpc/dinner.savePublished?batch=1",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ 0: { json: { publicSlug } } }),
            },
          );
          return response.status;
        }),
      );
    }, publicSlugs);

    expect(statuses.filter((status) => status === 200)).toHaveLength(20);
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    expect(
      await testDb.dinner.count({
        where: {
          householdId: destinationHouseholdId,
          sourceDinnerId: { in: sourceDinnerIds },
        },
      }),
    ).toBe(20);
  } finally {
    if (destinationHouseholdId) {
      await testDb.dinner.deleteMany({
        where: {
          householdId: destinationHouseholdId,
          OR: [
            { name: markerName },
            ...(sourceDinnerIds.length > 0
              ? [{ sourceDinnerId: { in: sourceDinnerIds } }]
              : []),
          ],
        },
      });
    }
    if (sourceHouseholdId) {
      await testDb.dinner.deleteMany({
        where: { householdId: sourceHouseholdId },
      });
      await testDb.household.deleteMany({ where: { id: sourceHouseholdId } });
    }
  }
});
