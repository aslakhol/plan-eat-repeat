import { createPrismaClient } from "@planeatrepeat/db";
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
      name: "Removal test",
      slug: `removal-${crypto.randomUUID()}`,
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
    createDinner: (name: string) =>
      db.dinner.create({ data: { name, householdId: household.id } }),
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
async function clear(page: Page) {
  await page
    .locator("summary")
    .filter({ hasText: "Shopping list actions" })
    .click();
  await page
    .getByRole("button", { name: "Clear the list", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Clear the list?",
    exact: true,
  });
  await dialog
    .getByRole("button", { name: "Clear the list", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
}
async function navigate(page: Page) {
  await page.getByRole("link", { name: "Cookbook", exact: true }).click();
  await page.getByRole("link", { name: "Shopping list", exact: true }).click();
}

test("Clear waits for earlier adds and moves, preserves later additions, and settles without refreshes", async ({
  page,
}) => {
  const fixture = await setup(page);
  const before = Promise.withResolvers<void>();
  const removal = Promise.withResolvers<void>();
  const reads = Promise.withResolvers<void>();
  const staleRead = Promise.withResolvers<void>();
  const captured = Promise.withResolvers<void>();
  const delivered = Promise.withResolvers<void>();
  let captureRead = false;
  let additions = 0,
    moves = 0,
    clears = 0,
    holdReads = false;
  await fixture.createItem("Earlier move");
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.addSelection")
    ) {
      additions++;
      if (additions === 1) await before.promise;
      await route.continue();
    } else if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.remove?")
    ) {
      moves++;
      await before.promise;
      await route.continue();
    } else if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.clear")
    ) {
      clears++;
      const response = await route.fetch();
      await removal.promise;
      await route.fulfill({ response });
    } else if (
      captureRead &&
      request.method() === "GET" &&
      request.url().includes("shoppingList.list")
    ) {
      captureRead = false;
      const response = await route.fetch();
      captured.resolve();
      await staleRead.promise;
      await route.fulfill({ response });
      delivered.resolve();
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
      .getByRole("button", {
        name: "Remove Earlier move from list",
        exact: true,
      })
      .click();
    await add(page, "Earlier addition");
    await expect.poll(() => additions + moves).toBe(2);
    await clear(page);
    expect(clears).toBe(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Clearing" }),
    ).toBeVisible();
    await add(page, "Later addition");
    captureRead = true;
    await navigate(page);
    await captured.promise;
    await expect(
      page.getByRole("list", { name: "Shopping items", exact: true }),
    ).not.toContainText("Earlier");
    expect(additions).toBe(1);
    before.resolve();
    await expect.poll(() => clears).toBe(1);
    holdReads = true;
    removal.resolve();
    await expect.poll(() => additions).toBe(2);
    await expect(
      page.getByRole("button", {
        name: "Remove Later addition from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Add Earlier addition to shopping list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Add Earlier move to shopping list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("status").filter({ hasText: "Clearing" }),
    ).toHaveCount(0);
    staleRead.resolve();
    await delivered.promise;
    await expect(
      page.getByRole("button", {
        name: "Remove Earlier move from list",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Remove Later addition from list",
        exact: true,
      }),
    ).toBeEnabled();
  } finally {
    before.resolve();
    removal.resolve();
    reads.resolve();
    staleRead.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("a failed Clear survives navigation and retry preserves later changes to the same requirement", async ({
  page,
}) => {
  const fixture = await setup(page);
  const gate = Promise.withResolvers<void>();
  await fixture.createItem("Keep later quantity");
  await fixture.createItem("Clear original");
  let attempts = 0;
  await page.route("**/api/trpc/shoppingList.clear?*", async (route) => {
    attempts++;
    if (attempts === 1) {
      await gate.promise;
      await route.abort("failed");
    } else await route.continue();
  });
  try {
    await fixture.open();
    await clear(page);
    await expect(
      page.getByRole("heading", { name: "Nothing on the list" }),
    ).toBeVisible();
    await add(page, "Later success");
    gate.resolve();
    await expect(
      page.getByRole("alert").filter({ hasText: "Could not clear" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove Later success from list" }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Edit Keep later quantity", exact: true })
      .click();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await editor.getByLabel("Amount", { exact: true }).fill("4");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Remove Keep later quantity from list",
      }),
    ).toBeEnabled();
    await navigate(page);
    await page
      .getByRole("alert")
      .filter({ hasText: "Could not clear" })
      .getByRole("button", { name: "Retry" })
      .click();
    await expect(
      page.getByRole("button", { name: "Add Clear original to shopping list" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Keep later quantity",
      }),
    ).toHaveText("4");
    await expect(
      page.getByRole("button", { name: "Remove Later success from list" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Remove Clear original from list" }),
    ).toHaveCount(0);
  } finally {
    gate.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Delete waits for an edit merge, forgets only that variant, and retains a later re-add", async ({
  page,
}) => {
  const fixture = await setup(page);
  await fixture.createItem("Source eggs");
  await fixture.createItem("Eggs", "duck");
  await fixture.createItem("Eggs", "hen");
  const editGate = Promise.withResolvers<void>();
  const deleteGate = Promise.withResolvers<void>();
  const reads = Promise.withResolvers<void>();
  let edits = 0,
    deletes = 0,
    holdReads = false;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.edit?")
    ) {
      edits++;
      const response = await route.fetch();
      await editGate.promise;
      await route.fulfill({ response });
    } else if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.deleteOwnItem")
    ) {
      deletes++;
      const response = await route.fetch();
      await deleteGate.promise;
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
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await page
      .getByRole("button", { name: "Edit Source eggs", exact: true })
      .click();
    await editor.getByLabel("Item", { exact: true }).fill("Eggs");
    await editor.getByLabel("Note", { exact: true }).fill("duck");
    await editor.getByLabel("Amount", { exact: true }).fill("2");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(() => edits).toBe(1);
    await page
      .getByRole("button", {
        name: "Edit quantity for Eggs, duck",
        exact: true,
      })
      .filter({ hasText: /^2$/ })
      .click();
    await editor
      .getByRole("button", { name: "Delete own item", exact: true })
      .click();
    await expect(editor).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Remove Eggs, duck from list",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Remove Eggs, hen from list",
        exact: true,
      }),
    ).toBeEnabled();
    expect(deletes).toBe(0);
    editGate.resolve();
    await expect.poll(() => deletes).toBe(1);
    await navigate(page);
    await expect(
      page.getByRole("status").filter({ hasText: "Deleting" }),
    ).toBeVisible();
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("button", { name: "Add shopping item" })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Add an item",
      exact: true,
    });
    await drawer.getByRole("combobox", { name: "Item name" }).fill("Eggs duck");
    await drawer
      .getByRole("option", { name: "Eggs, duck", exact: true })
      .click();
    await expect(drawer).not.toBeVisible();
    holdReads = true;
    deleteGate.resolve();
    await expect(
      page.getByRole("button", {
        name: "Remove Eggs, duck from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Remove Eggs, hen from list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Edit quantity for Eggs, duck",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Deleting" }),
    ).toHaveCount(0);
  } finally {
    editGate.resolve();
    deleteGate.resolve();
    reads.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("a failed Delete restores the variant and reviews current data after later work and navigation", async ({
  page,
}) => {
  const fixture = await setup(page);
  await fixture.createItem("Eggs", "duck");
  await fixture.createItem("Eggs", "hen");
  const gate = Promise.withResolvers<void>();
  await page.route(
    "**/api/trpc/shoppingList.deleteOwnItem?*",
    async (route) => {
      await gate.promise;
      await route.abort("failed");
    },
  );
  try {
    await fixture.open();
    const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
    await page
      .getByRole("button", { name: "Edit Eggs, duck", exact: true })
      .click();
    await editor
      .getByRole("button", { name: "Delete own item", exact: true })
      .click();
    await expect(editor).not.toBeVisible();
    await add(page, "Later success");
    await navigate(page);
    gate.resolve();
    await expect(
      page.getByRole("alert").filter({ hasText: "Could not delete Eggs" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove Later success from list" }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Edit Eggs, duck", exact: true })
      .click();
    await editor.getByLabel("Amount", { exact: true }).fill("4");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Remove Eggs, duck from list" }),
    ).toBeEnabled();
    await navigate(page);
    await page
      .getByRole("button", { name: "Review item", exact: true })
      .click();
    await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("4");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Remove Eggs, hen from list" }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Remove Later success from list" }),
    ).toBeEnabled();
  } finally {
    gate.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});

test("Clear includes a pending Dinner addition after its picker is dismissed", async ({
  page,
}) => {
  const fixture = await setup(page);
  await fixture.createItem("Original item");
  await fixture.createDinner("Pending dinner");
  const gate = Promise.withResolvers<void>();
  let additions = 0,
    clears = 0;
  await page.route("**/api/trpc/shoppingList.addDinners?*", async (route) => {
    additions++;
    await gate.promise;
    await route.continue();
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.clear")
    )
      clears++;
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
    await picker.getByRole("searchbox").fill("Pending dinner");
    await picker.getByRole("button", { name: /Pending dinner/ }).click();
    await picker
      .getByRole("button", { name: "Add 1 dinner", exact: true })
      .click();
    await expect.poll(() => additions).toBe(1);
    await page.keyboard.press("Escape");
    await expect(picker).not.toBeVisible();
    await clear(page);
    expect(clears).toBe(0);
    gate.resolve();
    await expect(
      page.getByRole("button", {
        name: "Add Pending dinner to shopping list",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", {
        name: "Remove Pending dinner from list",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Clearing" }),
    ).toHaveCount(0);
  } finally {
    gate.resolve();
    try {
      await page.unrouteAll({ behavior: "wait" });
    } finally {
      await fixture.cleanup();
    }
  }
});
