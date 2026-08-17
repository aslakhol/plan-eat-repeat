import { createRequire } from "node:module";

import { expect, test, type Page } from "@playwright/test";
import { createPrismaClient } from "@planeatrepeat/db";

import { completeLocalAuth, provisionLocalAuth } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const testDb = createPrismaClient(databaseUrl);

test.afterAll(async () => testDb.$disconnect());

const uniqueId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const publishedDinnerAction = (page: Page) =>
  page.getByRole("article").getByRole("button", {
    name: "Add to my cookbook",
  });

const resetLocalIdentity = async (userId: string) => {
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
};

test("sign-in returns a Save Intent to the stable URL, saves latest content once, and cleans the query", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = uniqueId();
  const publicSlug = `save-intent-sign-in-${marker}`;
  const returnPath = `/d/${publicSlug}?save=1`;
  const auth = await provisionLocalAuth(page, "save-intent-existing");
  await resetLocalIdentity(auth.userId);
  await testDb.user.create({
    data: { id: auth.userId, firstName: "Existing", lastName: "Visitor" },
  });
  const destinationHousehold = await testDb.household.create({
    data: {
      name: `Existing destination ${marker}`,
      slug: `existing-destination-${marker}`,
      Members: { create: { userId: auth.userId, role: "ADMIN" } },
    },
  });
  const sourceHousehold = await testDb.household.create({
    data: { name: `Source ${marker}`, slug: `source-${marker}` },
  });
  const source = await testDb.dinner.create({
    data: {
      name: `Before authentication ${marker}`,
      notes: "Before authentication",
      householdId: sourceHousehold.id,
      publicSlug,
      publishedAt: new Date(),
    },
  });

  try {
    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await testDb.dinner.update({
      where: { id: source.id },
      data: {
        name: `Latest source content ${marker}`,
        notes: "Changed during authentication",
      },
    });
    const returnedRequest = page.waitForRequest((request) =>
      request.url().endsWith(returnPath),
    );
    await completeLocalAuth(page, auth.ticket, returnPath);
    await returnedRequest;

    await expect(
      page.getByRole("dialog", { name: "Saved to your cookbook" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/d/${publicSlug}$`));
    expect(
      await testDb.dinner.findMany({
        where: {
          householdId: destinationHousehold.id,
          sourceDinnerId: source.id,
        },
        select: { name: true, notes: true },
      }),
    ).toEqual([
      {
        name: `Latest source content ${marker}`,
        notes: "Changed during authentication",
      },
    ]);

    await page.reload();
    await expect(
      page
        .getByRole("article")
        .getByRole("button", { name: "Already in your cookbook" }),
    ).toBeVisible();
    expect(
      await testDb.dinner.count({
        where: {
          householdId: destinationHousehold.id,
          sourceDinnerId: source.id,
        },
      }),
    ).toBe(1);
  } finally {
    await resetLocalIdentity(auth.userId);
    await testDb.dinner.deleteMany({ where: { id: source.id } });
    await testDb.household.deleteMany({ where: { id: sourceHousehold.id } });
  }
});

test("sign-up return bootstraps a usable one-person Household without onboarding", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = uniqueId();
  const publicSlug = `save-intent-sign-up-${marker}`;
  const returnPath = `/d/${publicSlug}?save=1`;
  const auth = await provisionLocalAuth(page, "save-intent-first-time");
  await resetLocalIdentity(auth.userId);
  const sourceHousehold = await testDb.household.create({
    data: {
      name: `First-time source ${marker}`,
      slug: `first-source-${marker}`,
    },
  });
  const source = await testDb.dinner.create({
    data: {
      name: `First-time save ${marker}`,
      householdId: sourceHousehold.id,
      publicSlug,
      publishedAt: new Date(),
    },
  });

  try {
    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const returnedRequest = page.waitForRequest((request) =>
      request.url().endsWith(returnPath),
    );
    await completeLocalAuth(page, auth.ticket, returnPath);
    await returnedRequest;

    const savedDialog = page.getByRole("dialog", {
      name: "Saved to your cookbook",
    });
    await expect(savedDialog).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/d/${publicSlug}$`));
    const membership = await testDb.membership.findUniqueOrThrow({
      where: { userId: auth.userId },
      include: { household: true },
    });
    expect(membership.role).toBe("ADMIN");
    expect(membership.household.name).toBe("First Time's household");
    expect(
      await testDb.dinner.count({
        where: {
          householdId: membership.householdId,
          sourceDinnerId: source.id,
        },
      }),
    ).toBe(1);

    await savedDialog.getByRole("link", { name: "Open my cookbook" }).click();
    await expect(page).toHaveURL(/\/dinners$/);
    await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
  } finally {
    await resetLocalIdentity(auth.userId);
    await testDb.dinner.deleteMany({ where: { id: source.id } });
    await testDb.household.deleteMany({ where: { id: sourceHousehold.id } });
  }
});

test("a Dinner stopped during authentication saves nothing and returns the unavailable continuation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = uniqueId();
  const publicSlug = `save-intent-stopped-${marker}`;
  const returnPath = `/d/${publicSlug}?save=1`;
  const auth = await provisionLocalAuth(page, "save-intent-first-time");
  await resetLocalIdentity(auth.userId);
  const sourceHousehold = await testDb.household.create({
    data: {
      name: `Stopped source ${marker}`,
      slug: `stopped-source-${marker}`,
    },
  });
  const source = await testDb.dinner.create({
    data: {
      name: `Stop during auth ${marker}`,
      householdId: sourceHousehold.id,
      publicSlug,
      publishedAt: new Date(),
    },
  });

  try {
    await page.goto(`/d/${publicSlug}`);
    await publishedDinnerAction(page).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await testDb.dinner.update({
      where: { id: source.id },
      data: { publishedAt: null },
    });
    const returnedRequest = page.waitForRequest((request) =>
      request.url().endsWith(returnPath),
    );
    await completeLocalAuth(page, auth.ticket, returnPath);
    await returnedRequest;

    await expect(
      page.getByRole("heading", {
        name: "This dinner is no longer shared",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Continue to Plan Eat Repeat" }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/d/${publicSlug}$`));
    expect(
      await testDb.user.findUnique({ where: { id: auth.userId } }),
    ).toBeNull();
    expect(
      await testDb.dinner.count({ where: { sourceDinnerId: source.id } }),
    ).toBe(0);
  } finally {
    await resetLocalIdentity(auth.userId);
    await testDb.dinner.deleteMany({ where: { id: source.id } });
    await testDb.household.deleteMany({ where: { id: sourceHousehold.id } });
  }
});
