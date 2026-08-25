import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";

import {
  publicDinnerListPath,
  publicDinnerListUrl,
} from "~/lib/public-dinner-list";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl)
  throw new Error("NEXT_PUBLIC_APP_URL is required for browser tests");
const testDb = createPrismaClient(databaseUrl);

test.afterAll(async () => testDb.$disconnect());

const occurrences = (text: string, value: string) =>
  text.split(value).length - 1;

test("search discovery follows the active lifecycle of a Public Dinner List without exposing Household activity", async ({
  page,
}) => {
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const householdName = `Cooks & Friends ${marker}`;
  const householdPublicSlug = `original-cooks-name-${marker}`;
  const inactivePublicSlug = `inactive-household-${marker}`;
  const unpublishedDinnerName = `Private Saturday plans ${marker}`;
  const memberName = `Private member ${marker}`;
  const planDate = new Date("2044-04-05T00:00:00.000Z");
  const [household, inactiveHousehold] = await testDb.$transaction([
    testDb.household.create({
      data: {
        name: householdName,
        slug: `discoverable-public-list-${marker}`,
        publicSlug: householdPublicSlug,
      },
    }),
    testDb.household.create({
      data: {
        name: `Inactive Household ${marker}`,
        slug: `inactive-public-list-${marker}`,
        publicSlug: inactivePublicSlug,
      },
    }),
  ]);
  const publishedDinners = await testDb.$transaction(
    ["Soup night", "Friday curry"].map((name, index) =>
      testDb.dinner.create({
        data: {
          name: `${name} ${marker}`,
          householdId: household.id,
          publicSlug: `discoverable-dinner-${index}-${marker}`,
          publishedAt: new Date(Date.UTC(2026, 7, 23 - index, 12)),
          favourite: true,
        },
      }),
    ),
  );
  const privateDinner = await testDb.dinner.create({
    data: {
      name: unpublishedDinnerName,
      householdId: household.id,
      favourite: true,
    },
  });
  await testDb.dinner.create({
    data: {
      name: `Stopped Dinner ${marker}`,
      householdId: inactiveHousehold.id,
      publicSlug: `stopped-dinner-${marker}`,
      publishedAt: null,
    },
  });
  const user = await testDb.user.create({
    data: { id: `public-list-discovery-${marker}`, firstName: memberName },
  });
  await testDb.membership.create({
    data: { householdId: household.id, userId: user.id, role: "MEMBER" },
  });
  await testDb.plan.create({
    data: { dinnerId: privateDinner.id, date: planDate },
  });

  const householdPath = publicDinnerListPath(householdPublicSlug);
  const canonicalUrl = publicDinnerListUrl(householdPublicSlug, appUrl);
  const inactiveUrl = publicDinnerListUrl(inactivePublicSlug, appUrl);
  const title = `Dinners shared by ${householdName} · Plan Eat Repeat`;
  const description = `Browse dinners shared publicly by ${householdName} on Plan Eat Repeat.`;

  try {
    const activeResponse = await page.goto(householdPath);
    expect(activeResponse?.status()).toBe(200);
    const activeHtml = await activeResponse!.text();
    for (const dinner of publishedDinners) {
      expect(activeHtml).toContain(`href="/d/${dinner.publicSlug!}"`);
      expect(activeHtml).toContain(dinner.name);
    }
    expect(activeHtml).not.toContain(unpublishedDinnerName);
    expect(activeHtml).not.toContain(memberName);
    expect(activeHtml).not.toContain(planDate.toISOString());
    expect(activeHtml).not.toContain("favourite");
    await expect(page).toHaveTitle(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalUrl,
    );

    const activeSitemap = await page.request.get("/sitemap.xml");
    expect(activeSitemap.status()).toBe(200);
    const activeSitemapXml = await activeSitemap.text();
    expect(occurrences(activeSitemapXml, `<loc>${canonicalUrl}</loc>`)).toBe(1);
    expect(activeSitemapXml).not.toContain(`<loc>${inactiveUrl}</loc>`);
    expect(activeSitemapXml).not.toContain(unpublishedDinnerName);
    expect(activeSitemapXml).not.toContain(memberName);
    expect(activeSitemapXml).not.toContain(planDate.toISOString());

    await testDb.dinner.updateMany({
      where: { householdId: household.id },
      data: { publishedAt: null },
    });
    const inactiveResponse = await page.goto(householdPath);
    expect(inactiveResponse?.status()).toBe(404);
    const inactiveHtml = await inactiveResponse!.text();
    expect(inactiveHtml).toContain("This page is no longer shared");
    expect(inactiveHtml).toContain('name="robots" content="noindex, nofollow"');
    expect(inactiveHtml).not.toContain(householdName);
    expect(inactiveHtml).not.toContain(publishedDinners[0]!.name);
    const inactiveSitemap = await page.request.get("/sitemap.xml");
    expect(await inactiveSitemap.text()).not.toContain(
      `<loc>${canonicalUrl}</loc>`,
    );

    await testDb.dinner.update({
      where: { id: publishedDinners[0]!.id },
      data: { publishedAt: new Date("2026-08-24T12:00:00.000Z") },
    });
    const restoredResponse = await page.goto(householdPath);
    expect(restoredResponse?.status()).toBe(200);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonicalUrl,
    );
    const restoredSitemap = await page.request.get("/sitemap.xml");
    expect(
      occurrences(await restoredSitemap.text(), `<loc>${canonicalUrl}</loc>`),
    ).toBe(1);
  } finally {
    await testDb.plan.deleteMany({ where: { dinnerId: privateDinner.id } });
    await testDb.dinner.deleteMany({
      where: { householdId: { in: [household.id, inactiveHousehold.id] } },
    });
    await testDb.household.deleteMany({
      where: { id: { in: [household.id, inactiveHousehold.id] } },
    });
    await testDb.user.deleteMany({ where: { id: user.id } });
  }
});
