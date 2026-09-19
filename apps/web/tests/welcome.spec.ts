import { createRequire } from "node:module";
import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
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
const db = createPrismaClient(databaseUrl);
test.afterAll(async () => db.$disconnect());

test("a new user can enter the app, follow a welcome link, and return without setup", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, "/shopping-list");
    const welcome = page.getByRole("dialog", {
      name: "Welcome to Plan Eat Repeat",
    });
    await expect(welcome).toBeVisible({ timeout: 30_000 });
    await welcome.getByRole("link", { name: "Cookbook" }).click();
    await expect(page).toHaveURL(/\/dinners$/);
    await expect(welcome).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await db.user.findUniqueOrThrow({ where: { id: auth.userId } }))
            .welcomeSeenAt,
      )
      .not.toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cookbook", exact: true }),
    ).toBeVisible();
    await expect(welcome).not.toBeVisible();
    const membership = await db.membership.findUniqueOrThrow({
      where: { userId: auth.userId },
    });
    expect(
      await db.dinner.count({ where: { householdId: membership.householdId } }),
    ).toBe(0);
  } finally {
    await resetLocalIdentity(db, auth.userId);
  }
});

test("an invitation finishes before the welcome and uses the invited household", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  const household = await db.household.create({
    data: {
      name: "Welcome test household",
      slug: `welcome-${crypto.randomUUID()}`,
    },
  });
  const invite = await db.invite.create({
    data: {
      householdId: household.id,
      expiresAt: new Date(Date.now() + 120_000),
    },
  });
  try {
    await page.goto(`/invite/${invite.id}`);
    await expect(
      page.getByRole("button", { name: "Sign up to join" }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, `/invite/${invite.id}`);
    await expect(
      page.getByRole("button", { name: "Join Household" }),
    ).toBeVisible();
    expect(
      await db.membership.findUnique({ where: { userId: auth.userId } }),
    ).toBeNull();
    await page.getByRole("button", { name: "Join Household" }).click();
    const welcome = page.getByRole("dialog", {
      name: "Welcome to Plan Eat Repeat",
    });
    await expect(welcome).toBeVisible({ timeout: 30_000 });
    expect(
      (
        await db.membership.findUniqueOrThrow({
          where: { userId: auth.userId },
        })
      ).householdId,
    ).toBe(household.id);
    const done = welcome.getByRole("button", { name: "Have a look around" });
    await done.scrollIntoViewIfNeeded();
    await expect(done).toBeInViewport();
    await done.click();
    await expect(welcome).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await db.user.findUniqueOrThrow({ where: { id: auth.userId } }))
            .welcomeSeenAt,
      )
      .not.toBeNull();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Cookbook", exact: true }),
    ).toBeVisible();
    await expect(welcome).not.toBeVisible();
  } finally {
    await resetLocalIdentity(db, auth.userId);
    await db.household.deleteMany({ where: { id: household.id } });
  }
});
