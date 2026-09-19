import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import {
  completeLocalAuth,
  provisionLocalAuth,
  resetLocalIdentity,
} from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
const { createClerkClient } = createRequire(import.meta.url)(
  "@clerk/nextjs/server",
) as typeof import("@clerk/nextjs/server");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
test.afterAll(async () => db.$disconnect());

test("changing Household discards old shopping results and queued moves", async ({
  page,
}) => {
  const { userId } = await provisionLocalAuth(page, "save-intent-existing");
  await resetLocalIdentity(db, userId);
  await db.user.create({ data: { id: userId, welcomeSeenAt: new Date() } });
  const marker = crypto.randomUUID();
  const households = await Promise.all(
    ["before", "after"].map((suffix) =>
      db.household.create({
        data: {
          name: `Shopping ${suffix}`,
          slug: `shopping-${marker}-${suffix}`,
        },
      }),
    ),
  );
  const before = households[0]!;
  const after = households[1]!;
  await db.membership.create({
    data: { householdId: before.id, userId, role: "ADMIN" },
  });
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { householdId: before.id },
  });
  const names = [`Before ${marker}`, `After ${marker}`];
  for (const [index, household] of households.entries()) {
    await db.ownItem.create({
      data: {
        householdId: household.id,
        name: names[index]!,
        normalizedName: names[index]!.toLowerCase(),
        category: "OWN_ITEMS",
        items: { create: {} },
      },
    });
  }
  const gate = Promise.withResolvers<void>();
  const saved = Promise.withResolvers<void>();
  let restores = 0;
  await page.route("**/api/trpc/shoppingList.remove*", async (route) => {
    const response = await route.fetch();
    saved.resolve();
    await gate.promise;
    await route.fulfill({ response });
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.addRecent")
    )
      restores += 1;
  });
  try {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "local login", exact: true }),
    ).toBeVisible();
    const auth = await provisionLocalAuth(page, "save-intent-existing");
    await completeLocalAuth(page, auth.ticket, "/shopping-list");
    await page
      .getByRole("button", {
        name: `Remove ${names[0]} from list`,
        exact: true,
      })
      .click();
    await saved.promise;
    await page
      .getByRole("button", {
        name: `Add ${names[0]} to shopping list`,
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Remove ${names[0]} from list`,
        exact: true,
      }),
    ).toBeEnabled();

    await db.membership.update({
      where: { userId },
      data: { householdId: after.id },
    });
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { householdId: after.id },
    });
    await page.evaluate(async () => {
      const clerk = (
        window as typeof window & {
          Clerk: {
            user: { reload: () => Promise<unknown> };
            session: {
              getToken: (options: { skipCache: boolean }) => Promise<unknown>;
            };
          };
        }
      ).Clerk;
      await clerk.user.reload();
      await clerk.session.getToken({ skipCache: true });
    });
    await expect(
      page.getByRole("button", {
        name: `Remove ${names[1]} from list`,
        exact: true,
      }),
    ).toBeEnabled();
    await expect(page.getByText(names[0]!, { exact: true })).toHaveCount(0);
    const completed = page.waitForResponse("**/api/trpc/shoppingList.remove*");
    gate.resolve();
    await completed;
    // Wait for a new read after the old mutation has completed.
    await page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("shoppingList.list"),
    );
    await expect(page.getByText(names[0]!, { exact: true })).toHaveCount(0);
    expect(restores).toBe(0);
    await expect(
      page.getByRole("button", {
        name: `Remove ${names[1]} from list`,
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.household.deleteMany({
      where: { id: { in: households.map((household) => household.id) } },
    });
    await db.user.deleteMany({ where: { id: userId } });
    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: { householdId: null },
    });
  }
});
