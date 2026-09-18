import { startOfDay } from "date-fns";
import { createPrismaClient, type Prisma } from "@planeatrepeat/db";
import { expect, test, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import {
  completeLocalAuth,
  provisionLocalAuth,
  resetLocalIdentity,
} from "./capture-support";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env") as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
const { createClerkClient } =
  require("@clerk/nextjs/server") as typeof import("@clerk/nextjs/server");
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
test.afterAll(async () => db.$disconnect());

async function setup(page: Page) {
  const { userId } = await provisionLocalAuth(page, "save-intent-existing");
  await resetLocalIdentity(db, userId);
  await db.user.create({ data: { id: userId } });
  const household = await db.household.create({
    data: {
      name: "Dinner addition test",
      slug: `dinner-add-${crypto.randomUUID()}`,
      Members: { create: { userId, role: "ADMIN" } },
    },
  });
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { householdId: household.id },
  });
  const createItem = (name: string, note = "") =>
    db.ownItem.create({
      data: {
        householdId: household.id,
        name,
        normalizedName: name.toLowerCase(),
        note: note || null,
        normalizedNote: note.toLowerCase(),
        category: "OWN_ITEMS",
        items: { create: { amount: 1 } },
      },
    });
  return {
    createItem,
    createDinner: (
      name: string,
      parts?: Prisma.RecipePartCreateNestedManyWithoutDinnerInput,
    ) => db.dinner.create({ data: { name, householdId: household.id, parts } }),
    usuallyHave: (name: string) =>
      db.ownItem.create({
        data: {
          householdId: household.id,
          name,
          normalizedName: name.toLowerCase(),
          category: "INGREDIENTS",
          usuallyHave: true,
        },
      }),
    async open() {
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "local login", exact: true }),
      ).toBeVisible();
      const auth = await provisionLocalAuth(page, "save-intent-existing");
      await completeLocalAuth(page, auth.ticket, "/shopping-list");
    },
    async cleanup() {
      await db.dinner.deleteMany({ where: { householdId: household.id } });
      await db.household.delete({ where: { id: household.id } });
      await db.user.delete({ where: { id: userId } });
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { householdId: null },
      });
    },
  };
}
async function add(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Add shopping item" })
    .click();
  const drawer = page.getByRole("dialog", { name: "Add an item", exact: true });
  await drawer.getByRole("combobox", { name: "Item name" }).fill(name);
  await drawer.getByRole("option", { name, exact: true }).click();
  await expect(drawer).not.toBeVisible();
}
async function navigate(page: Page) {
  await page.getByRole("link", { name: "Cookbook", exact: true }).click();
  await page.getByRole("link", { name: "Shopping list", exact: true }).click();
}

test("Dinner selections close immediately, survive navigation, and reconcile while reads and other writes are held", async ({
  page,
}) => {
  const fixture = await setup(page);
  await fixture.createItem("Existing item");
  await fixture.createDinner("Pending dinner");
  const gate = Promise.withResolvers<void>();
  const reads = Promise.withResolvers<void>();
  let started = false,
    holdReads = false;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.addDinners")
    ) {
      const response = await route.fetch();
      started = true;
      await gate.promise;
      await route.fulfill({ response });
    } else {
      if (
        holdReads &&
        request.method() === "GET" &&
        /shoppingList\.(list|recent)/.test(request.url())
      )
        await reads.promise;
      await route.continue();
    }
  });
  try {
    await fixture.open();
    await page
      .getByRole("button", { name: "Add an item", exact: true })
      .click();
    await page
      .getByRole("button", { name: "From the cookbook", exact: true })
      .click();
    const picker = page.getByRole("dialog", {
      name: "Add dinners",
      exact: true,
    });
    await picker.getByRole("button", { name: /Pending dinner/ }).click();
    await picker
      .getByRole("button", { name: "Add 1 dinner", exact: true })
      .click();
    await expect(picker).not.toBeVisible();
    await expect.poll(() => started).toBe(true);
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toHaveCount(0);
    await navigate(page);
    await expect(
      page.getByRole("status").filter({ hasText: "Adding Pending dinner" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Edit Existing item", exact: true })
      .click();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await editor.getByLabel("Amount", { exact: true }).fill("4");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Existing item",
        exact: true,
      }),
    ).toHaveText("4");
    await add(page, "Later manual addition");
    holdReads = true;
    gate.resolve();
    await expect(
      page.getByRole("button", {
        name: "Remove Pending dinner from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Remove Later manual addition from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("status").filter({ hasText: "Adding Pending dinner" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Existing item",
        exact: true,
      }),
    ).toHaveText("4");
  } finally {
    gate.resolve();
    reads.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("a lost Dinner-add response retains repeated selections and safely retries after navigation and later edits", async ({
  page,
}) => {
  const fixture = await setup(page);
  const dinner = await fixture.createDinner("Bread", {
    create: {
      order: 0,
      ingredients: {
        create: [
          { order: 0, name: "Flour", amount: 250, unit: "g" },
          { order: 1, name: "Salt", amount: 1, unit: "g" },
        ],
      },
    },
  });
  await fixture.usuallyHave("Salt");
  await db.plan.create({
    data: { dinnerId: dinner.id, date: startOfDay(new Date()) },
  });
  const first = Promise.withResolvers<void>();
  const committed = Promise.withResolvers<void>();
  const retry = Promise.withResolvers<void>();
  const reads = Promise.withResolvers<void>();
  let attempts = 0,
    holdReads = false;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.addDinners")
    ) {
      attempts++;
      if (attempts === 1) {
        await route.fetch();
        committed.resolve();
        await first.promise;
        await route.abort("failed");
      } else {
        const response = await route.fetch();
        await retry.promise;
        await route.fulfill({ response });
      }
    } else {
      if (
        holdReads &&
        request.method() === "GET" &&
        /shoppingList\.(list|recent)/.test(request.url())
      )
        await reads.promise;
      await route.continue();
    }
  });
  try {
    await fixture.open();
    await page
      .getByRole("button", { name: "Add an item", exact: true })
      .click();
    await page
      .getByRole("button", { name: "From week plan", exact: true })
      .click();
    const picker = page.getByRole("dialog", {
      name: "Add dinners",
      exact: true,
    });
    await picker.getByRole("button", { name: /Bread/ }).click();
    await picker.getByRole("button", { name: "Cookbook", exact: true }).click();
    await picker.getByRole("button", { name: /Bread/ }).click();
    await picker
      .getByRole("button", { name: "Add 2 dinners", exact: true })
      .click();
    await expect(picker).not.toBeVisible();
    await committed.promise;
    await navigate(page);
    first.resolve();
    const failure = page
      .getByRole("alert")
      .filter({ hasText: "Could not add Bread, Bread" });
    await expect(failure).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Flour",
        exact: true,
      }),
    ).toHaveText("500 g");
    await page.getByRole("button", { name: "Edit Flour", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await editor.getByLabel("Amount", { exact: true }).fill("700");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Remove Flour from list", exact: true }),
    ).toBeEnabled();
    await navigate(page);
    await failure.getByRole("button", { name: "Retry", exact: true }).click();
    await expect.poll(() => attempts).toBe(2);
    holdReads = true;
    retry.resolve();
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Flour",
        exact: true,
      }),
    ).toHaveText("700 g");
    await expect(
      page.getByRole("button", {
        name: "Add Salt to shopping list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(failure).toHaveCount(0);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    holdReads = false;
    reads.resolve();
    await expect(
      page.getByRole("button", {
        name: "Add Salt to shopping list",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Flour",
        exact: true,
      }),
    ).toHaveText("700 g");
  } finally {
    first.resolve();
    retry.resolve();
    reads.resolve();
    committed.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Dinner details and Plan release immediately and retain a failed selection after navigation", async ({
  page,
}) => {
  const fixture = await setup(page);
  const dinner = await fixture.createDinner("Dinner from details");
  const planned = await fixture.createDinner("Dinner from Plan");
  await db.plan.create({
    data: { dinnerId: planned.id, date: startOfDay(new Date()) },
  });
  const gate = Promise.withResolvers<void>();
  let attempts = 0;
  await page.route("**/api/trpc/shoppingList.addDinners?*", async (route) => {
    attempts++;
    if (attempts === 1) {
      await gate.promise;
      await route.abort("failed");
    } else await route.continue();
  });
  try {
    await fixture.open();
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await page.locator(`a[href="/dinners/${dinner.id}"]`).click();
    await page.locator("summary").filter({ hasText: "Dinner actions" }).click();
    await page
      .getByRole("button", { name: "Add to shopping list", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dinners$/);
    await page.getByRole("link", { name: "Plan", exact: true }).press("Enter");
    await page
      .getByTestId("plan-day-trigger")
      .filter({ hasText: planned.name })
      .click();
    const plannedDialog = page.getByRole("dialog", {
      name: planned.name,
      exact: true,
    });
    await plannedDialog
      .locator("summary")
      .filter({ hasText: "Planned Dinner actions" })
      .click();
    await plannedDialog
      .getByRole("button", { name: "Add to shopping list", exact: true })
      .click();
    await expect(plannedDialog).not.toBeVisible();
    await page
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Adding Dinner from details" }),
    ).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Adding Dinner from Plan" }),
    ).toBeVisible();
    gate.resolve();
    const failure = page
      .getByRole("alert")
      .filter({ hasText: "Could not add Dinner from details" });
    await expect(failure).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Remove Dinner from plan from list",
        exact: true,
      }),
    ).toBeEnabled();
    await navigate(page);
    await failure.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Remove Dinner from details from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(failure).toHaveCount(0);
  } finally {
    gate.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});
