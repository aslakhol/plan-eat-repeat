import { createRequire } from "node:module";

import { expect, test } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";
import { createClerkClient } from "@clerk/backend";

import {
  completeLocalAuth,
  provisionLocalAuth,
  resetLocalIdentity,
} from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");
const appUrl = process.env.NEXT_PUBLIC_APP_URL;
if (!appUrl)
  throw new Error("NEXT_PUBLIC_APP_URL is required for browser tests");
const clerkSecretKey = process.env.CLERK_SECRET_KEY;
if (!clerkSecretKey)
  throw new Error("CLERK_SECRET_KEY is required for browser tests");
const testDb = createPrismaClient(databaseUrl);
const testClerk = createClerkClient({ secretKey: clerkSecretKey });

test.afterAll(async () => testDb.$disconnect());

test("Shared Dinners links the Household's active Public Dinner List and hides the link after the last publication stops", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const householdName = `Hendersons ${marker}`;
  const householdPublicSlug = `original-household-name-${marker}`;
  const dinnerName = `Shared pasta ${marker}`;
  const auth = await provisionLocalAuth(page, "save-intent-first-time");
  await resetLocalIdentity(testDb, auth.userId);
  await testDb.user.create({
    data: { id: auth.userId, firstName: "Shared", lastName: "Dinners" },
  });
  const household = await testDb.household.create({
    data: {
      name: householdName,
      slug: `shared-dinners-public-list-${marker}`,
      publicSlug: householdPublicSlug,
      Members: { create: { userId: auth.userId, role: "ADMIN" } },
    },
  });
  await testClerk.users.updateUserMetadata(auth.userId, {
    publicMetadata: { householdId: household.id },
  });
  const dinner = await testDb.dinner.create({
    data: {
      name: dinnerName,
      householdId: household.id,
      publicSlug: `shared-pasta-${marker}`,
      publishedAt: new Date("2026-08-23T12:00:00.000Z"),
    },
  });
  await testDb.dinner.createMany({
    data: Array.from({ length: 14 }, (_, index) => ({
      name: `Extra shared Dinner ${String(index + 1).padStart(2, "0")} ${marker}`,
      householdId: household.id,
      publicSlug: `extra-shared-${index + 1}-${marker}`,
      publishedAt: new Date(Date.UTC(2026, 7, 22 - index, 12)),
    })),
  });
  const publicPath = `/h/${householdPublicSlug}`;
  const publicUrl = new URL(publicPath, appUrl);
  const displayedPublicUrl = `${publicUrl.host}${publicUrl.pathname}`;

  try {
    await page.goto("/");
    await page.waitForFunction(
      () =>
        "Clerk" in window &&
        Boolean(
          (
            window as typeof window & {
              Clerk?: { client?: { signIn?: unknown } };
            }
          ).Clerk?.client?.signIn,
        ),
    );
    await completeLocalAuth(page, auth.ticket, "/dinners/shared");

    await expect(
      page.getByRole("heading", { name: "Shared dinners" }),
    ).toBeVisible();
    const publicListLink = page.locator("[data-shared-dinners-public-list]");
    await expect(publicListLink).toBeVisible();
    await expect(publicListLink).toHaveAttribute("href", publicPath);
    await expect(
      publicListLink.getByText(`${householdName} public page`, { exact: true }),
    ).toBeVisible();
    await expect(
      publicListLink.getByText(displayedPublicUrl, { exact: true }),
    ).toBeVisible();
    await expect(
      publicListLink.getByText("View", { exact: true }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search shared dinners…")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Recently shared" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect
      .poll(async () =>
        Math.round((await publicListLink.boundingBox())?.y ?? -1),
      )
      .toBe(16);
    await page.evaluate(() => window.scrollTo(0, 0));

    await publicListLink
      .getByText(`${householdName} public page`, { exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${publicPath}$`));
    await page.goBack();
    await expect(publicListLink).toBeVisible();
    await publicListLink.getByText("View", { exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${publicPath}$`));

    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "Shared dinners" }),
    ).toBeVisible();
    await testDb.dinner.updateMany({
      where: { householdId: household.id, id: { not: dinner.id } },
      data: { publishedAt: null },
    });
    await page.getByRole("link", { name: new RegExp(dinnerName) }).click();
    await expect(
      page.getByRole("dialog", { name: "Shared dinner details" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Stop sharing" }).click();
    await expect(page).toHaveURL(/\/dinners\/shared$/);
    await expect(publicListLink).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "No shared dinners yet" }),
    ).toBeVisible();
  } finally {
    await resetLocalIdentity(testDb, auth.userId);
    await testClerk.users.updateUserMetadata(auth.userId, {
      publicMetadata: { householdId: null },
    });
  }
});
