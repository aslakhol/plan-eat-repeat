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
  const navigationHeld = Promise.withResolvers<void>();
  const navigationStarted = Promise.withResolvers<void>();
  await page.route(/\/_next\/data\/[^/]+\/dinners\.json/, async (route) => {
    navigationStarted.resolve();
    await navigationHeld.promise;
    await route.continue();
  });
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
    await navigationStarted.promise;
    // Let click updates and the closing animation finish while navigation is held.
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/shopping-list$/);
    await expect(welcome).toBeVisible();
    navigationHeld.resolve();
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
    navigationHeld.resolve();
    await resetLocalIdentity(db, auth.userId);
  }
});

test("a welcome link to the current page dismisses the welcome", async ({
  page,
}) => {
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  try {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, "/shopping-list");
    const welcome = page.getByRole("dialog", {
      name: "Welcome to Plan Eat Repeat",
    });
    await expect(welcome).toBeVisible({ timeout: 30_000 });
    await welcome.getByRole("link", { name: "Shopping list" }).click();
    await expect(page).toHaveURL(/\/shopping-list$/);
    await expect(welcome).not.toBeVisible();
    await expect
      .poll(
        async () =>
          (await db.user.findUniqueOrThrow({ where: { id: auth.userId } }))
            .welcomeSeenAt,
      )
      .not.toBeNull();
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

test("signed-in navigation and direct page reads do not wait for a welcome request", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  await db.user.create({
    data: { id: auth.userId, welcomeSeenAt: new Date() },
  });
  const household = await db.household.create({
    data: {
      name: "Loading test household",
      slug: `loading-${crypto.randomUUID()}`,
      Members: { create: { userId: auth.userId, role: "ADMIN" } },
    },
  });
  await db.user.update({
    where: { id: auth.userId },
    data: { welcomeSeenAt: new Date() },
  });
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, "/");
    await expect(
      page.getByRole("heading", { name: "Week", exact: true }),
    ).toBeVisible();
    const welcomeRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("household.welcomeStatus"))
        welcomeRequests.push(request.url());
    });
    for (const [path, procedure] of [
      ["/", "plan.weekOverview"],
      ["/dinners", "dinner.summaries"],
      ["/shopping-list", "shoppingList.list"],
      ["/settings", "household.household"],
      ["/shopping-list/usually-have", "shoppingList.usuallyHave"],
    ] as const) {
      const held = Promise.withResolvers<void>();
      const reading = Promise.withResolvers<void>();
      const continued = Promise.withResolvers<void>();
      const handler = async (route: import("@playwright/test").Route) => {
        if (!route.request().url().includes(procedure)) return route.continue();
        reading.resolve();
        await held.promise;
        await route.continue();
        continued.resolve();
      };
      await page.route("**/api/trpc/**", handler);
      try {
        await page.goto(path);
        await reading.promise;
        const nav = page
          .getByRole("navigation", { name: "Primary navigation" })
          .filter({ visible: true });
        await expect(
          nav.getByRole("link", { name: "Cookbook", exact: true }),
        ).toBeVisible();
        await expect(
          nav.getByRole("link", { name: "Shopping list", exact: true }),
        ).toBeVisible();
        expect(welcomeRequests).toEqual([]);
      } finally {
        held.resolve();
        await continued.promise;
        await page.unroute("**/api/trpc/**", handler);
      }
    }
  } finally {
    await resetLocalIdentity(db, auth.userId);
    await db.household.deleteMany({ where: { id: household.id } });
  }
});

test("local welcome dismissal survives save failure and older page responses", async ({
  page,
}) => {
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  const captured = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let holdNextRead = false;
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    if (url.includes("household.dismissWelcome")) return route.abort();
    if (!holdNextRead || !url.includes("shoppingList.list"))
      return route.continue();
    holdNextRead = false;
    const response = await route.fetch();
    captured.resolve();
    await release.promise;
    await route.fulfill({ response });
  });
  try {
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, "/shopping-list");
    const welcome = page.getByRole("dialog", {
      name: "Welcome to Plan Eat Repeat",
    });
    await expect(welcome).toBeVisible({ timeout: 30_000 });
    holdNextRead = true;
    await captured.promise;
    await welcome.getByRole("button", { name: "Close welcome" }).click();
    await expect(welcome).not.toBeVisible();
    await expect(
      page.getByText(
        "We couldn't save that you’ve seen the welcome. It may appear next time.",
        { exact: true },
      ),
    ).toBeVisible();
    const staleResponse = page.waitForResponse((response) =>
      response.url().includes("shoppingList.list"),
    );
    release.resolve();
    await staleResponse;
    await expect(welcome).not.toBeVisible();
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .filter({ visible: true })
      .getByRole("link", { name: "Cookbook", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Cookbook", exact: true }),
    ).toBeVisible();
    await expect(welcome).not.toBeVisible();
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: auth.userId } }))
        .welcomeSeenAt,
    ).toBeNull();
  } finally {
    release.resolve();
    await resetLocalIdentity(db, auth.userId);
  }
});

test("a first Settings visit keeps navigation visible during automatic Household setup", async ({
  page,
}) => {
  const auth = await provisionLocalAuth(page, "welcome-new-user");
  await resetLocalIdentity(db, auth.userId);
  const starting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route("**/api/trpc/household.start**", async (route) => {
    starting.resolve();
    await release.promise;
    await route.continue();
  });
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/onboarding");
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await completeLocalAuth(page, auth.ticket, "/settings");
    await starting.promise;
    await expect(
      page
        .getByRole("navigation", { name: "Primary navigation" })
        .getByRole("link", { name: "Shopping list", exact: true }),
    ).toBeVisible();
    release.resolve();
    await expect(
      page.getByRole("dialog", { name: "Welcome to Plan Eat Repeat" }),
    ).toBeVisible({ timeout: 30_000 });
    expect(await db.membership.count({ where: { userId: auth.userId } })).toBe(
      1,
    );
    await expect(
      page.getByText("Something went wrong", { exact: true }),
    ).not.toBeVisible();
  } finally {
    release.resolve();
    await resetLocalIdentity(db, auth.userId);
  }
});
