import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { SAVED_READS_KEY } from "../src/lib/saved-reads";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

test("reopening shows saved Plan and Shopping before refreshing, and survives failed reads and pending moves", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const date = await page
    .getByTestId("plan-day-trigger")
    .first()
    .getAttribute("data-date");
  const marker = crypto.randomUUID();
  const dinner = await db.dinner.create({
    data: {
      name: `Saved dinner ${marker}`,
      householdId,
      Plan: { create: { date: new Date(`${date}T00:00:00`) } },
    },
  });
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name: `Saved item ${marker}`,
      normalizedName: `saved item ${marker}`,
      category: "OWN_ITEMS",
      items: { create: {} },
    },
  });
  const gate = Promise.withResolvers<void>();
  let hold = true;
  let fail = false;
  let holdMoves = false;
  const moveGate = Promise.withResolvers<void>();
  try {
    await page.reload();
    await expect(
      page.getByTestId("plan-day-trigger").filter({ hasText: dinner.name }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), SAVED_READS_KEY),
      )
      .toContain(dinner.name);
    await page.goto("/shopping-list");
    const remove = page.getByRole("button", {
      name: `Remove ${ownItem.name} from list`,
      exact: true,
    });
    await expect(remove).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), SAVED_READS_KEY),
      )
      .toContain(ownItem.name);

    await page.route("**/api/trpc/**", async (route) => {
      const request = route.request();
      if (
        request.method() === "GET" &&
        /plan.weekOverview|shoppingList.list|shoppingList.recent/.test(
          request.url(),
        )
      ) {
        if (hold) await gate.promise;
        if (fail) {
          await route.abort("failed");
          return;
        }
      }
      if (
        holdMoves &&
        request.method() === "POST" &&
        request.url().includes("shoppingList.remove")
      ) {
        await moveGate.promise;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await page.goto("/");
    const planned = page
      .getByTestId("plan-day-trigger")
      .filter({ hasText: dinner.name });
    await expect(planned).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Updating" }),
    ).toBeVisible();
    fail = true;
    hold = false;
    gate.resolve();
    await expect(
      page.getByRole("status").filter({ hasText: "Couldn't refresh" }),
    ).toBeVisible();
    await expect(planned).toBeVisible();
    await page.goto("/shopping-list");
    await expect(remove).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Couldn't refresh" }),
    ).toBeVisible();

    // A pending check-off must not replace the confirmed saved list.
    holdMoves = true;
    await remove.click();
    await expect(remove).not.toBeVisible();
    await page.reload();
    await expect(remove).toBeVisible();
    holdMoves = false;
    moveGate.resolve();

    await db.ownItem.update({
      where: { id: ownItem.id },
      data: { name: `Fresh item ${marker}` },
    });
    fail = false;
    await expect(
      page.getByRole("button", {
        name: `Remove Fresh item ${marker} from list`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Couldn't refresh" }),
    ).not.toBeVisible();
  } finally {
    gate.resolve();
    moveGate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.dinner.delete({ where: { id: dinner.id } });
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});
