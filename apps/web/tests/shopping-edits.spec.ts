import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

test("edits dismiss immediately, survive stale reads and navigation, and retain failed drafts without rolling back other items", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Edits ${crypto.randomUUID()}`;
  const names = [`${marker} first`, `${marker} other`];
  for (const name of names)
    await db.ownItem.create({
      data: {
        householdId,
        name,
        normalizedName: name.toLowerCase(),
        category: "OWN_ITEMS",
        items: { create: { amount: 1 } },
      },
    });
  const gate = Promise.withResolvers<void>();
  let firstRequested = false;
  let writes = 0;
  await page.route("**/api/trpc/shoppingList.edit?*", async (route) => {
    writes++;
    if (writes === 1) {
      firstRequested = true;
      await gate.promise;
      await route.abort("failed");
    } else await route.continue();
  });
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
  const edit = async (name: string, amount: string) => {
    await page
      .getByRole("button", { name: `Edit ${name}`, exact: true })
      .click();
    await editor.getByLabel("Amount", { exact: true }).fill(amount);
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
  };
  try {
    await page.goto("/shopping-list");
    await edit(names[0]!, "2");
    await expect.poll(() => firstRequested).toBe(true);
    await expect(
      page.getByRole("button", { name: `Edit quantity for ${names[0]}` }),
    ).toHaveText("2");
    await edit(names[0]!, "3");
    expect(writes).toBe(1);
    await edit(names[1]!, "4");
    await expect.poll(() => writes).toBe(2);
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await page
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await page.waitForResponse(
      (r) =>
        r.request().method() === "GET" && r.url().includes("shoppingList.list"),
    );
    await expect(
      page.getByRole("button", { name: `Edit quantity for ${names[0]}` }),
    ).toHaveText("3");
    gate.resolve();
    await expect.poll(() => writes).toBe(3);
    await expect(
      page.getByRole("button", { name: `Edit quantity for ${names[1]}` }),
    ).toHaveText("4");
    await expect(
      page.getByRole("button", { name: `Edit quantity for ${names[0]}` }),
    ).toHaveText("3");
    await expect(
      page.getByRole("alert").filter({ hasText: `Could not save ${names[0]}` }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await page
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await page.getByRole("button", { name: "Edit failed draft" }).click();
    await expect(editor.getByLabel("Amount", { exact: true })).toHaveValue("2");
    await editor.getByLabel("Amount", { exact: true }).fill("5");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: `Edit quantity for ${names[0]}` }),
    ).toHaveText("5");
    await expect(
      page.getByRole("button", { name: "Edit failed draft" }),
    ).toHaveCount(0);
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.ownItem.deleteMany({
      where: { householdId, name: { startsWith: marker } },
    });
  }
});

test("a held merge response reconciles identities and queues another edit without waiting for refreshes", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Merge ${crypto.randomUUID()}`;
  const sourceName = `${marker} source`;
  const targetName = `${marker} target`;
  for (const [name, amount, unit] of [
    [sourceName, 1, "kg"],
    [targetName, 500, "g"],
  ] as const) {
    await db.ownItem.create({
      data: {
        householdId,
        name,
        normalizedName: name.toLowerCase(),
        category: "OWN_ITEMS",
        items: { create: { amount, unit } },
      },
    });
  }
  const saved = Promise.withResolvers<void>();
  const mutationGate = Promise.withResolvers<void>();
  const readGate = Promise.withResolvers<void>();
  let blockReads = false;
  let writes = 0;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.url().includes("shoppingList.edit")
    ) {
      writes++;
      const response = await route.fetch();
      if (writes === 1) {
        saved.resolve();
        await mutationGate.promise;
      }
      await route.fulfill({ response });
    } else if (
      blockReads &&
      request.method() === "GET" &&
      /shoppingList\.(list|recent|sources|usuallyHave)/.test(request.url())
    ) {
      await readGate.promise;
      await route.continue();
    } else await route.continue();
  });
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
  try {
    await page.goto("/shopping-list");
    await page
      .getByRole("button", { name: `Edit ${sourceName}`, exact: true })
      .click();
    await editor.getByLabel("Item", { exact: true }).fill(targetName);
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    await saved.promise;
    // Polling already sees the merged identity, but the pending source stays editable.
    await page.waitForResponse(
      (r) =>
        r.request().method() === "GET" && r.url().includes("shoppingList.list"),
    );
    await page
      .getByRole("button", {
        name: `Edit quantity for ${targetName}`,
        exact: true,
      })
      .filter({ hasText: "1 kg" })
      .click();
    await editor.getByLabel("Amount", { exact: true }).fill("2");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    expect(writes).toBe(1);
    blockReads = true;
    mutationGate.resolve();
    await expect.poll(() => writes).toBe(2);
    await expect(
      page.getByRole("button", { name: `Edit ${targetName}`, exact: true }),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${targetName}`,
        exact: true,
      }),
    ).toHaveText("2 kg");
    await expect(
      page.getByRole("button", {
        name: `Remove ${targetName} from list`,
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByRole("button", { name: "Edit failed draft" }),
    ).toHaveCount(0);
  } finally {
    mutationGate.resolve();
    readGate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.ownItem.deleteMany({
      where: { householdId, name: { startsWith: marker } },
    });
  }
});
