import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";

import { publicDinnerListPath } from "~/lib/public-dinner-list";
import { publishedDinnerPath } from "~/lib/published-dinner";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const testDb = createPrismaClient(databaseUrl);

test.afterAll(async () => testDb.$disconnect());

test("an anonymous visitor browses every Published Dinner with the approved controls and responsive layout", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const householdName = `Hendersons ${uniqueId}`;
  const householdPublicSlug = `hendersons-${uniqueId}`;
  const tag = (name: string) => `${name} ${uniqueId}`;
  const names = {
    alpha: `Alpha soup ${uniqueId}`,
    beta: `Beta curry ${uniqueId}`,
    delta: `Delta pasta ${uniqueId}`,
    epsilon: `Epsilon tacos ${uniqueId}`,
    eta: `Eta stew ${uniqueId}`,
    gamma: `Gamma salad ${uniqueId}`,
    theta: `Theta pie ${uniqueId}`,
    zeta: `Zeta noodles ${uniqueId}`,
  };
  const households = await testDb.$transaction(
    ["source", "first-copy", "second-copy", "other"].map((kind, index) =>
      testDb.household.create({
        data: {
          name: `${kind} ${uniqueId}`,
          slug: `public-list-ui-${kind}-${uniqueId}-${index}`,
          publicSlug:
            kind === "source" ? householdPublicSlug : `${kind}-${uniqueId}`,
        },
      }),
    ),
  );
  const [source, firstCopy, secondCopy, other] = households;
  if (!source || !firstCopy || !secondCopy || !other) {
    throw new Error("Public Dinner List fixture households were not created");
  }
  await testDb.household.update({
    where: { id: source.id },
    data: { name: householdName },
  });

  const dinnerDefinitions = [
    { key: "alpha", daysAgo: 8, tags: [tag("Comfort")] },
    { key: "beta", daysAgo: 1, tags: [tag("Quick"), tag("Indian")] },
    { key: "gamma", daysAgo: 2, tags: [tag("Quick"), tag("Vegetarian")] },
    { key: "delta", daysAgo: 3, tags: [tag("Italian")] },
    { key: "epsilon", daysAgo: 4, tags: [tag("Quick")] },
    { key: "zeta", daysAgo: 5, tags: [tag("Vegetarian")] },
    { key: "eta", daysAgo: 6, tags: [tag("Comfort")] },
    { key: "theta", daysAgo: 7, tags: [tag("Dessert")] },
  ] as const;
  const dinners = [];
  for (const definition of dinnerDefinitions) {
    dinners.push(
      await testDb.dinner.create({
        data: {
          name: names[definition.key],
          householdId: source.id,
          publicSlug: `public-list-${definition.key}-${uniqueId}`,
          publishedAt: new Date(Date.UTC(2026, 7, 22 - definition.daysAgo, 12)),
          tags: {
            connectOrCreate: definition.tags.map((value) => ({
              where: { value },
              create: { value },
            })),
          },
        },
      }),
    );
  }
  const beta = dinners[1]!;
  const gamma = dinners[2]!;
  await testDb.dinner.createMany({
    data: [
      {
        name: `Beta copy one ${uniqueId}`,
        householdId: firstCopy.id,
        sourceDinnerId: beta.id,
      },
      {
        name: `Beta copy two ${uniqueId}`,
        householdId: firstCopy.id,
        sourceDinnerId: beta.id,
      },
      {
        name: `Beta copy three ${uniqueId}`,
        householdId: secondCopy.id,
        sourceDinnerId: beta.id,
      },
      {
        name: `Gamma copy ${uniqueId}`,
        householdId: firstCopy.id,
        sourceDinnerId: gamma.id,
      },
    ],
  });
  await testDb.dinner.create({
    data: {
      name: `Private source Dinner ${uniqueId}`,
      householdId: source.id,
      tags: {
        connectOrCreate: {
          where: { value: tag("Private") },
          create: { value: tag("Private") },
        },
      },
    },
  });
  await testDb.dinner.create({
    data: {
      name: `Other Published Dinner ${uniqueId}`,
      householdId: other.id,
      publicSlug: `other-published-${uniqueId}`,
      publishedAt: new Date(),
      tags: {
        connectOrCreate: {
          where: { value: tag("Other") },
          create: { value: tag("Other") },
        },
      },
    },
  });

  const householdPath = publicDinnerListPath(householdPublicSlug);
  const dinnerLinks = page.locator("[data-public-dinner-link]");

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(householdPath);
    await expect(
      page.getByRole("heading", { name: householdName }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search their dinners…")).toBeVisible();
    await expect(page.getByPlaceholder("Search their dinners…")).toHaveCSS(
      "height",
      "42px",
    );
    await expect(
      page.getByRole("button", { name: "Filter by tags" }),
    ).toHaveCSS("height", "42px");
    await expect(
      page.getByRole("button", { name: "Recently shared" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "A–Z" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Most saved" }),
    ).toBeVisible();
    await expect(dinnerLinks).toHaveCount(8);
    await expect(dinnerLinks.first()).toContainText(names.beta);
    await expect(page.getByRole("status")).toHaveText("Showing 8 dinners");
    await expect(
      page.getByRole("button", { name: /more dinners/ }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "A–Z" }).click();
    await expect(dinnerLinks.first()).toContainText(names.alpha);
    await expect(dinnerLinks).toHaveCount(8);
    await expect(dinnerLinks.last()).toContainText(names.zeta);

    await page.getByRole("button", { name: "Most saved" }).click();
    await expect(dinnerLinks.nth(0)).toContainText(names.beta);
    await expect(dinnerLinks.nth(0)).toContainText("saved by 2");
    await expect(dinnerLinks.nth(1)).toContainText(names.gamma);
    await expect(dinnerLinks.nth(1)).toContainText("saved by 1");
    await page.getByRole("button", { name: "A–Z" }).click();
    await expect(dinnerLinks.first().getByText(/saved by/)).toHaveCount(0);

    await page.getByPlaceholder("Search their dinners…").fill("dessert");
    await expect(dinnerLinks).toHaveCount(1);
    await expect(dinnerLinks.first()).toContainText(names.theta);
    await page.getByPlaceholder("Search their dinners…").fill("");

    await page.getByRole("button", { name: "Filter by tags" }).click();
    await expect(page.getByText(tag("Private"), { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText(tag("Other"), { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: new RegExp(`^${tag("Quick")} 3$`) })
      .click();
    await page
      .getByRole("button", { name: new RegExp(`^${tag("Vegetarian")} 2$`) })
      .click();
    await page.getByRole("button", { name: "Show 1 dinner" }).click();
    await expect(dinnerLinks).toHaveCount(1);
    await expect(dinnerLinks.first()).toContainText(names.gamma);

    await page.getByPlaceholder("Search their dinners…").fill("no such dinner");
    await expect(
      page.getByRole("heading", { name: "No dinners match" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(dinnerLinks).toHaveCount(8);

    await expect(
      page.getByRole("link", { name: "Start my cookbook" }),
    ).toHaveCount(2);
    for (const cta of await page
      .getByRole("link", { name: "Start my cookbook" })
      .all()) {
      await expect(cta).toHaveAttribute("href", "/onboarding");
    }
    await expect(
      page.locator("[data-public-list-desktop-footer]"),
    ).toBeVisible();
    await expect(page.locator("[data-public-list-mobile-upsell]")).toBeHidden();

    await page.getByRole("link", { name: "Start my cookbook" }).first().click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.goto(householdPath);

    await page.getByPlaceholder("Search their dinners…").fill("beta curry");
    await dinnerLinks.first().click();
    await expect(page).toHaveURL(
      new RegExp(`${publishedDinnerPath(beta.publicSlug!)}$`),
      { timeout: 15_000 },
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(householdPath);
    await expect(
      page.locator("[data-public-list-mobile-upsell]"),
    ).toBeVisible();
    await expect(
      page.locator("[data-public-list-desktop-footer]"),
    ).toBeHidden();
    await expect(page.locator("[data-public-list-mobile-wordmark]")).toHaveCSS(
      "font-size",
      "13px",
    );
    await expect(page.getByPlaceholder("Search their dinners…")).toHaveCSS(
      "height",
      "38px",
    );
    await expect(
      page.getByRole("button", { name: "Filter by tags" }),
    ).toHaveCSS("height", "38px");
    await expect(page.locator("[data-public-dinner-list]")).toHaveCSS(
      "display",
      "block",
    );
  } finally {
    await testDb.dinner.deleteMany({
      where: {
        householdId: { in: households.map((household) => household.id) },
      },
    });
    await testDb.tag.deleteMany({ where: { value: { endsWith: uniqueId } } });
    await testDb.household.deleteMany({
      where: { id: { in: households.map((household) => household.id) } },
    });
  }
});
