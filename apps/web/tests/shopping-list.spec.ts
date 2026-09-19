import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

async function leaveAndReturnToShopping(page: Page) {
  await page.getByRole("link", { name: /^(Cookbook|Dinners)$/ }).click();
  await expect(page).toHaveURL(/\/dinners$/);
  await page.getByRole("link", { name: "Shopping list", exact: true }).click();
  await expect(page).toHaveURL(/\/shopping-list$/);
}

test("the navigation plus follows the current page", async ({ page }) => {
  await ensureSignedIn(page);
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const addItemSheet = page.getByRole("dialog", {
    name: "Add an item",
    exact: true,
  });
  const addDinnerSheet = page.getByRole("dialog", {
    name: "Add a dinner",
    exact: true,
  });

  await navigation.getByRole("link", { name: "Shopping list" }).click();
  await navigation.getByRole("button", { name: "Add shopping item" }).click();
  await expect(
    addItemSheet.getByRole("combobox", { name: "Item name" }),
  ).toBeVisible();
  await expect(addDinnerSheet).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(addItemSheet).not.toBeVisible();

  for (const [name, pathname] of [
    ["Plan", "/"],
    ["Cookbook", "/dinners"],
    ["Settings", "/settings"],
  ] as const) {
    await navigation.getByRole("link", { name, exact: true }).press("Enter");
    await expect(page).toHaveURL(new URL(pathname, page.url()).href);
    await navigation
      .getByRole("button", { name: "Add Dinner", exact: true })
      .click();
    await expect(addDinnerSheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(addDinnerSheet).not.toBeVisible();
  }

  await navigation.getByRole("link", { name: "Shopping list" }).click();
  await expect(addItemSheet).not.toBeVisible();
  await navigation.getByRole("button", { name: "Add shopping item" }).click();
  await expect(addItemSheet).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(addItemSheet).not.toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/shopping-list$/);
  await expect(addItemSheet).not.toBeVisible();
});

test("desktop navigation adds shopping items from Usually have", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 850 });
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const name = `Navigation ${crypto.randomUUID()}`;
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      category: "OWN_ITEMS",
      usuallyHave: true,
    },
  });
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  const addItemSheet = page.getByRole("dialog", {
    name: "Add an item",
    exact: true,
  });

  try {
    await navigation
      .getByRole("link", { name: "Cookbook", exact: true })
      .click();
    await navigation
      .getByRole("button", { name: "Add Dinner", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Add a dinner", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await navigation
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await page
      .locator("summary")
      .filter({ hasText: "Shopping list actions" })
      .click();
    await page.getByRole("link", { name: "Usually have", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Usually have", exact: true }),
    ).toBeVisible();
    await navigation
      .getByRole("button", { name: "Add item", exact: true })
      .click();
    await addItemSheet
      .getByRole("combobox", { name: "Item name", exact: true })
      .fill(name);
    await addItemSheet.getByRole("option", { name, exact: true }).click();
    await expect(addItemSheet).not.toBeVisible();
    await expect(page).toHaveURL(/\/shopping-list\/usually-have$/);
    await expect
      .poll(() => db.shoppingItem.count({ where: { ownItemId: ownItem.id } }))
      .toBe(1);
    expect(
      (await db.ownItem.findUniqueOrThrow({ where: { id: ownItem.id } }))
        .usuallyHave,
    ).toBe(true);

    // The shared flow also includes the dinner picker, not just manual entry.
    await navigation
      .getByRole("button", { name: "Add item", exact: true })
      .click();
    await addItemSheet
      .getByRole("button", { name: "From the cookbook", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Add dinners", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await navigation
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: `Remove ${name} from list`,
        exact: true,
      }),
    ).toBeVisible();
    await navigation
      .getByRole("button", { name: "Add item", exact: true })
      .click();
    await expect(addItemSheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      navigation.getByRole("button", { name: "Add item", exact: true }),
    ).toBeFocused();

    await navigation
      .getByRole("link", { name: "Settings", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Settings", exact: true }),
    ).toBeVisible();
    await expect(
      navigation.getByRole("button", { name: "Add Dinner", exact: true }),
    ).toBeVisible();
  } finally {
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});

test("add shopping items, remove them, and edit and restore Recently Used", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = crypto.randomUUID();
  const manualName = `Apples ${marker}`;
  const ingredientName = `Lentils ${marker}`;
  let ingredientLabel = `${ingredientName}, organic`;
  await db.ownItem.create({
    data: {
      householdId,
      name: ingredientName,
      normalizedName: ingredientName.toLowerCase(),
      normalizedNote: "",
      category: "INGREDIENTS",
    },
  });
  const dinner = await db.dinner.create({
    data: {
      householdId,
      name: `Soup ${marker}`,
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: {
              order: 0,
              name: `${ingredientName} organic`,
              amount: 200,
              unit: "g",
              note: "Rinse before cooking",
            },
          },
        },
      },
    },
  });
  const removeItem = (name: string) =>
    page.getByRole("button", {
      name: `Remove ${name === ingredientName ? ingredientLabel : name} from list`,
      exact: true,
    });
  const editor = page.getByRole("dialog", { name: "Edit item", exact: true });
  const moveBeforeResponse = async (
    action: Locator,
    procedure: "addRecent" | "remove",
  ) => {
    const url = `**/api/trpc/shoppingList.${procedure}*`;
    const gate = Promise.withResolvers<void>();
    await page.route(url, async (route) => {
      await gate.promise;
      await route.continue();
    });
    const request = page.waitForRequest(url);
    const response = page.waitForResponse(url);
    try {
      await action.click();
      await request;
      // The source row must disappear before the server responds.
      await expect(action).not.toBeVisible({ timeout: 500 });
    } finally {
      gate.resolve();
      await response;
      await page.unroute(url);
    }
  };
  try {
    await page
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("button", { name: "Add shopping item", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Item name", exact: true })
      .fill(manualName);
    await page.getByRole("option", { name: manualName, exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Add an item", exact: true }),
    ).not.toBeVisible();
    await expect(removeItem(manualName)).toBeVisible();
    await page.reload();
    await expect(removeItem(manualName)).toBeVisible();

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
    await picker.getByRole("searchbox").fill(dinner.name);
    await picker.getByRole("button", { name: new RegExp(dinner.name) }).click();
    await picker
      .getByRole("button", { name: "Add 1 dinner", exact: true })
      .click();
    await expect(picker).not.toBeVisible();
    await expect(removeItem(ingredientName)).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      }),
    ).toHaveText("200 g");

    await page
      .getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      })
      .click();
    const nameInput = editor.getByRole("textbox", {
      name: "Item",
      exact: true,
    });
    const amountInput = editor.getByRole("textbox", {
      name: "Amount",
      exact: true,
    });
    const noteInput = editor.getByRole("textbox", {
      name: "Note",
      exact: true,
    });
    await expect(nameInput).toHaveValue(ingredientName);
    await expect(noteInput).toHaveValue("organic");
    await nameInput.fill(" ");
    await page.keyboard.press("Escape");
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("alert")).toHaveText("Enter an item name");
    await nameInput.fill(ingredientName);
    await amountInput.fill("-1");
    await page.mouse.click(5, 5);
    await expect(editor).toBeVisible();
    await expect(amountInput).toHaveValue("-1");
    await amountInput.fill("250");
    await noteInput.fill("For dinner");

    const saveUrl = "**/api/trpc/shoppingList.edit*";
    await page.route(saveUrl, (route) => route.abort("failed"));
    await page.mouse.click(5, 5);
    await expect(editor).not.toBeVisible();
    await page.getByRole("button", { name: "Edit failed draft" }).click();
    await expect(noteInput).toHaveValue("For dinner");
    await page.unroute(saveUrl);
    // Saving the recovered draft also works by tapping the backdrop.
    const drawer = await editor.boundingBox();
    if (!drawer) throw new Error("Item drawer not visible");
    await page.mouse.click(5, drawer.y - 10);
    await expect(editor).not.toBeVisible();
    ingredientLabel = `${ingredientName}, For dinner`;
    await expect(removeItem(ingredientName)).toBeEnabled();
    await page.reload();
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      }),
    ).toHaveText("250 g");

    // Add another saved variant while the first one remains on the list.
    await page
      .getByRole("button", { name: "Add an item", exact: true })
      .click();
    await page
      .getByRole("combobox", { name: "Item name", exact: true })
      .fill(ingredientName);
    await page
      .getByRole("combobox", { name: "Item name", exact: true })
      .press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Add an item", exact: true }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: `Edit ${ingredientName}`, exact: true })
      .click();
    await noteInput.fill("Green lentils");
    await amountInput.fill("400");
    await editor.getByRole("combobox", { name: "Unit", exact: true }).fill("g");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    const otherVariant = page.getByRole("button", {
      name: `Remove ${ingredientName}, Green lentils from list`,
      exact: true,
    });
    await expect(otherVariant).toBeVisible();

    await removeItem(manualName).click();
    await expect(removeItem(manualName)).toHaveCount(0);
    await removeItem(ingredientName).click();
    await expect(removeItem(ingredientName)).toHaveCount(0);
    await page.reload();
    await expect(removeItem(manualName)).toHaveCount(0);
    await expect(removeItem(ingredientName)).toHaveCount(0);

    const accordion = page.getByRole("button", {
      name: "Recently used",
      exact: true,
    });
    const addRecent = () =>
      page.getByRole("button", {
        name: `Add ${ingredientLabel} to shopping list`,
        exact: true,
      });
    await expect(accordion).toHaveAttribute("aria-expanded", "true");
    await expect(addRecent()).toBeVisible();
    await accordion.click();
    await page.reload();
    await expect(accordion).toHaveAttribute("aria-expanded", "false");
    await expect(addRecent()).not.toBeVisible();
    await accordion.click();

    await page
      .getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      })
      .click();
    await expect(noteInput).toHaveValue("For dinner");
    await editor
      .getByRole("textbox", { name: "Amount", exact: true })
      .fill("300");
    await editor
      .getByRole("textbox", { name: "Note", exact: true })
      .fill("Red lentils");
    await editor.getByRole("button", { name: "Done", exact: true }).click();
    await expect(editor).not.toBeVisible();
    ingredientLabel = `${ingredientName}, Red lentils`;
    await expect(otherVariant).toBeVisible();
    await moveBeforeResponse(addRecent(), "addRecent");
    await expect(removeItem(ingredientName)).toBeVisible();
    await expect(addRecent()).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      }),
    ).toHaveText("300 g");
    await moveBeforeResponse(removeItem(ingredientName), "remove");
    await expect(addRecent()).toBeVisible();
    await page
      .getByRole("button", { name: `Edit ${ingredientLabel}`, exact: true })
      .click();
    await expect(
      editor.getByRole("textbox", { name: "Note", exact: true }),
    ).toHaveValue("Red lentils");
    await editor
      .getByRole("button", { name: "Delete own item", exact: true })
      .click();
    await expect(editor).not.toBeVisible();
    await expect(addRecent()).toHaveCount(0);
    await expect(otherVariant).toBeVisible();
  } finally {
    await db.ownItem.deleteMany({
      where: { householdId, name: { in: [manualName, ingredientName] } },
    });
    await db.dinner.delete({ where: { id: dinner.id } });
  }
});

test("shopping previews keep typing through blur, scroll to choices, and support keyboard selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Preview${crypto.randomUUID()}`;
  await db.ownItem.createMany({
    data: Array.from({ length: 30 }, (_, index) => ({
      householdId,
      name: `${marker} ${String(index).padStart(2, "0")}`,
      normalizedName: `${marker.toLowerCase()} ${String(index).padStart(2, "0")}`,
      normalizedNote: "",
      category: "OWN_ITEMS",
    })),
  });
  try {
    await page.goto("/shopping-list");
    const open = page.getByRole("button", { name: "Add an item", exact: true });
    const drawer = page.getByRole("dialog", {
      name: "Add an item",
      exact: true,
    });
    const input = drawer.getByRole("combobox", { name: "Item name" });
    const sourcesReady = Promise.withResolvers<void>();
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("shoppingList.sources"))
        await sourcesReady.promise;
      await route.continue();
    });
    try {
      await open.click();
      await expect(input).not.toBeFocused();
      await input.fill(marker);
      await expect(drawer.getByRole("option")).toHaveCount(1);
      await input.press("ArrowDown");
      await expect(drawer.getByRole("option")).toHaveAttribute(
        "aria-selected",
        "true",
      );
    } finally {
      sourcesReady.resolve();
      await page.unrouteAll({ behavior: "wait" });
    }
    const last = drawer.getByRole("option", {
      name: `${marker} 29`,
      exact: true,
    });
    await expect(last).toHaveCount(1);
    await expect(
      drawer.getByRole("option", { name: marker, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await input.blur();
    await expect(
      drawer.getByRole("button", { name: "From the cookbook" }),
    ).not.toBeVisible();
    await last.scrollIntoViewIfNeeded();
    const refresh = Promise.withResolvers<void>();
    const refreshRequested = Promise.withResolvers<void>();
    let additions = 0;
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("shoppingList.addSelection")) {
        additions += 1;
        refreshRequested.resolve();
        await refresh.promise;
      }
      await route.continue();
    });
    try {
      await last.click();
      await refreshRequested.promise;
      await expect(drawer).not.toBeVisible();
      await leaveAndReturnToShopping(page);
      await expect(
        page.getByRole("button", { name: "Share", exact: true }),
      ).toBeDisabled();
      await expect(
        page
          .getByRole("list", { name: "Shopping items", exact: true })
          .getByText(`${marker} 29`, { exact: true }),
      ).toBeVisible();
      await open.click();
      await input.fill("Next purchase");
    } finally {
      refresh.resolve();
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.waitForLoadState("networkidle");
    expect(additions).toBe(1);
    await expect(input).toHaveValue("Next purchase");
    await page.keyboard.press("Escape");
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Remove ${marker} 29 from list`,
        exact: true,
      }),
    ).toBeVisible();
    await open.click();
    await expect(input).toBeEmpty();
    await expect(input).not.toBeFocused();
    await input.fill(marker);
    await expect(drawer.getByRole("option").first()).toBeVisible();
    await input.press("ArrowDown");
    await input.press("ArrowDown");
    await input.press("Enter");
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Remove ${marker} 01 from list`,
        exact: true,
      }),
    ).toBeVisible();
    await open.click();
    await input.fill(marker);
    await input.press("Enter");
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Remove ${marker} from list`,
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await db.ownItem.deleteMany({
      where: {
        householdId,
        normalizedName: { startsWith: marker.toLowerCase() },
      },
    });
  }
});

test("shopping previews update without disappearing while requests are delayed", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await page.goto("/shopping-list");
  await page.getByRole("button", { name: "Add an item", exact: true }).click();
  const drawer = page.getByRole("dialog", { name: "Add an item", exact: true });
  const input = drawer.getByRole("combobox", { name: "Item name" });
  await input.fill("Che");
  await expect(
    drawer.getByRole("option", { name: "Cheese", exact: true }),
  ).toBeVisible();
  const gate = Promise.withResolvers<void>();
  await page.route("**/api/trpc/**", async (route) => {
    await gate.promise;
    await route.continue();
  });
  try {
    await input.fill("Chee");
    await expect(
      drawer.getByRole("option", { name: "Cheese", exact: true }),
    ).toBeVisible({ timeout: 500 });
    await input.fill("Cheese bags");
    await expect(
      drawer.getByRole("option", { name: "Cheese, bags", exact: true }),
    ).toBeVisible();
    await input.fill("");
    await expect(drawer.getByRole("option")).toHaveCount(0);
  } finally {
    gate.resolve();
  }
});

test("a failed optimistic shopping add preserves overlapping successful adds", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Optimistic${crypto.randomUUID()}`;
  const failedName = `${marker} failed`;
  const savedName = `${marker} saved`;
  const gate = Promise.withResolvers<void>();
  const requested = Promise.withResolvers<void>();
  await page.route("**/api/trpc/shoppingList.addSelection*", async (route) => {
    if (route.request().postData()?.includes(failedName)) {
      requested.resolve();
      await gate.promise;
      await route.abort("failed");
    } else await route.continue();
  });
  const drawer = page.getByRole("dialog", { name: "Add an item", exact: true });
  const items = page.getByRole("list", { name: "Shopping items", exact: true });
  const add = async (name: string) => {
    await page
      .getByRole("button", { name: "Add an item", exact: true })
      .click();
    await drawer.getByRole("combobox", { name: "Item name" }).fill(name);
    await drawer.getByRole("combobox", { name: "Item name" }).press("Enter");
    await expect(drawer).not.toBeVisible();
  };
  try {
    await page.goto("/shopping-list");
    await add(failedName);
    await requested.promise;
    await leaveAndReturnToShopping(page);
    await expect(items.getByText(failedName, { exact: true })).toBeVisible();
    await add(savedName);
    const saved = page.getByRole("button", {
      name: `Remove ${savedName} from list`,
      exact: true,
    });
    await expect(saved).toBeEnabled();
    // Force a server refresh while the first add remains in flight.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(items.getByText(failedName, { exact: true })).toBeVisible();
    await add(savedName);
    await expect(items.getByText(savedName, { exact: true })).toHaveCount(1);
    await expect(saved).toBeEnabled();
    gate.resolve();
    await expect(items.getByText(failedName, { exact: true })).toHaveCount(0);
    await expect(
      page.getByText(`Could not add ${failedName}`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Something went wrong", { exact: true }),
    ).toHaveCount(0);
    await expect(saved).toBeVisible();
    await page.reload();
    await expect(items.getByText(savedName, { exact: true })).toHaveCount(1);
    await expect(items.getByText(failedName, { exact: true })).toHaveCount(0);
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.ownItem.deleteMany({
      where: {
        householdId,
        normalizedName: { startsWith: marker.toLowerCase() },
      },
    });
  }
});

for (const procedure of ["remove", "addRecent"] as const) {
  test(`optimistic ${procedure} survives polling and rolls back only the failed item`, async ({
    page,
  }) => {
    await ensureSignedIn(page);
    const response = await page.request.post("/api/dev/auth-bypass");
    const { userId } = (await response.json()) as { userId: string };
    const { householdId } = await db.membership.findUniqueOrThrow({
      where: { userId },
    });
    const marker = `Move${crypto.randomUUID()}`;
    const failedName = `${marker} failed`;
    const savedName = `${marker} saved`;
    const ownItems = await Promise.all(
      [failedName, savedName].map((name) =>
        db.ownItem.create({
          data: {
            householdId,
            name,
            normalizedName: name.toLowerCase(),
            category: "OWN_ITEMS",
          },
        }),
      ),
    );
    const records = await Promise.all(
      ownItems.map((item) => {
        const data = { ownItemId: item.id, householdId, amount: 2, unit: "kg" };
        return procedure === "remove"
          ? db.shoppingItem.create({ data })
          : db.recentShoppingItem.create({ data });
      }),
    );
    const gate = Promise.withResolvers<void>();
    const requested = Promise.withResolvers<void>();
    await page.route(
      `**/api/trpc/shoppingList.${procedure}*`,
      async (route) => {
        if (route.request().postData()?.includes(records[0]!.id)) {
          requested.resolve();
          await gate.promise;
          await route.abort("failed");
        } else await route.continue();
      },
    );
    const action = (name: string, recent: boolean) =>
      page.getByRole("button", {
        name: recent
          ? `Add ${name} to shopping list`
          : `Remove ${name} from list`,
        exact: true,
      });
    const fromRecent = procedure === "addRecent";
    try {
      await page.goto("/shopping-list");
      await action(failedName, fromRecent).click();
      await requested.promise;
      await expect(action(failedName, fromRecent)).not.toBeVisible({
        timeout: 500,
      });
      await expect(action(failedName, !fromRecent)).toBeVisible({
        timeout: 500,
      });
      await expect(action(failedName, !fromRecent)).toBeEnabled();
      await expect(
        page.getByRole("button", {
          name: `Edit quantity for ${failedName}`,
          exact: true,
        }),
      ).toHaveText("2 kg");
      await action(savedName, fromRecent).click();
      await expect(action(savedName, !fromRecent)).toBeEnabled();

      // Wait for a real poll returning the unchanged server state of the blocked item.
      await page.waitForResponse(
        (response) =>
          response.request().method() === "GET" &&
          response.url().includes("shoppingList.list"),
      );
      await expect(action(failedName, fromRecent)).not.toBeVisible();
      await expect(action(failedName, !fromRecent)).toBeVisible();
      gate.resolve();
      await expect(action(failedName, fromRecent)).toBeEnabled();
      await expect(action(failedName, !fromRecent)).not.toBeVisible();
      await expect(action(savedName, !fromRecent)).toBeEnabled();
      await expect(
        page.getByText("Could not update shopping list", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Something went wrong", { exact: true }),
      ).toHaveCount(0);
      await page.reload();
      await expect(action(failedName, fromRecent)).toBeEnabled();
      await expect(action(savedName, !fromRecent)).toBeEnabled();
    } finally {
      gate.resolve();
      await page.unrouteAll({ behavior: "wait" });
      await db.ownItem.deleteMany({
        where: { id: { in: ownItems.map((item) => item.id) } },
      });
    }
  });
}

test("the same shopping item can be moved repeatedly before earlier requests finish", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const name = `Repeated ${crypto.randomUUID()}`;
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      category: "OWN_ITEMS",
    },
  });
  await db.shoppingItem.create({
    data: { householdId, ownItemId: ownItem.id, amount: 2, unit: "kg" },
  });
  const removeGate = Promise.withResolvers<void>();
  const removeRequested = Promise.withResolvers<void>();
  const addGate = Promise.withResolvers<void>();
  const addSaved = Promise.withResolvers<void>();
  const refreshGate = Promise.withResolvers<void>();
  let blockRefresh = false;
  await page.route("**/api/trpc/**", async (route) => {
    const request = route.request();
    if (
      request.url().includes("shoppingList.remove") &&
      request.method() === "POST"
    ) {
      removeRequested.resolve();
      await removeGate.promise;
    }
    if (
      request.url().includes("shoppingList.addRecent") &&
      request.method() === "POST"
    ) {
      // The server has saved a new shopping row, but its response is still in transit.
      const response = await route.fetch();
      addSaved.resolve();
      await addGate.promise;
      await route.fulfill({ response });
      return;
    }
    if (blockRefresh && request.method() === "GET") await refreshGate.promise;
    await route.continue();
  });
  const remove = page.getByRole("button", {
    name: `Remove ${name} from list`,
    exact: true,
  });
  const restore = page.getByRole("button", {
    name: `Add ${name} to shopping list`,
    exact: true,
  });
  const edit = page.getByRole("button", { name: `Edit ${name}`, exact: true });
  try {
    await page.goto("/shopping-list");
    await remove.click();
    await removeRequested.promise;
    await leaveAndReturnToShopping(page);
    await expect(restore).toBeEnabled({ timeout: 500 });
    await restore.click();
    await expect(remove).toBeEnabled({ timeout: 500 });
    await remove.click();
    await expect(restore).toBeEnabled({ timeout: 500 });
    await restore.click();
    await expect(remove).toBeEnabled({ timeout: 500 });
    removeGate.resolve();
    await addSaved.promise;
    // A poll can now return the new server ID before the delayed add response.
    await page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        response.url().includes("shoppingList.list"),
    );
    await expect(remove).toHaveCount(1);
    await expect(remove).toBeEnabled({ timeout: 500 });
    await remove.click();
    await expect(restore).toBeEnabled({ timeout: 500 });
    await restore.click();
    await expect(remove).toBeEnabled({ timeout: 500 });
    await remove.click();
    await expect(restore).toBeEnabled({ timeout: 500 });
    blockRefresh = true;
    addGate.resolve();
    // Even a blocked refresh must not keep the item pending after its saves finish.
    await expect(edit).toBeEnabled();
    await expect(restore).toBeEnabled();
    expect(
      await db.shoppingItem.count({ where: { ownItemId: ownItem.id } }),
    ).toBe(0);
    await restore.click();
    await expect(remove).toBeEnabled({ timeout: 500 });
    await expect(edit).toBeEnabled();
    expect(
      await db.shoppingItem.count({ where: { ownItemId: ownItem.id } }),
    ).toBe(1);
    refreshGate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await page.reload();
    await expect(remove).toBeEnabled();
    await expect(restore).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${name}`,
        exact: true,
      }),
    ).toHaveText("2 kg");
  } finally {
    removeGate.resolve();
    addGate.resolve();
    refreshGate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});

test("a failed queued move returns to the last saved state and can be retried", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const name = `Queued ${crypto.randomUUID()}`;
  const ownItem = await db.ownItem.create({
    data: {
      householdId,
      name,
      normalizedName: name.toLowerCase(),
      category: "OWN_ITEMS",
    },
  });
  await db.recentShoppingItem.create({
    data: { householdId, ownItemId: ownItem.id, amount: 3, unit: "kg" },
  });
  const addGate = Promise.withResolvers<void>();
  const addRequested = Promise.withResolvers<void>();
  const removeGate = Promise.withResolvers<void>();
  const removeRequested = Promise.withResolvers<void>();
  let failRemove = true;
  await page.route("**/api/trpc/shoppingList.addRecent*", async (route) => {
    addRequested.resolve();
    await addGate.promise;
    await route.continue();
  });
  await page.route("**/api/trpc/shoppingList.remove*", async (route) => {
    if (failRemove) {
      failRemove = false;
      removeRequested.resolve();
      await removeGate.promise;
      await route.abort("failed");
    } else await route.continue();
  });
  const remove = page.getByRole("button", {
    name: `Remove ${name} from list`,
    exact: true,
  });
  const restore = page.getByRole("button", {
    name: `Add ${name} to shopping list`,
    exact: true,
  });
  const edit = page.getByRole("button", { name: `Edit ${name}`, exact: true });
  try {
    await page.goto("/shopping-list");
    await restore.click();
    await addRequested.promise;
    await expect(remove).toBeEnabled({ timeout: 500 });
    await remove.click();
    await expect(restore).toBeEnabled({ timeout: 500 });
    addGate.resolve();
    await removeRequested.promise;
    await leaveAndReturnToShopping(page);
    await expect(restore).toBeEnabled();
    removeGate.resolve();
    await expect(remove).toBeEnabled();
    await expect(restore).not.toBeVisible();
    await expect(edit).toBeEnabled();
    await expect(
      page.getByText("Could not update shopping list", { exact: true }),
    ).toBeVisible();
    await remove.click();
    await expect(restore).toBeEnabled({ timeout: 500 });
    await expect(edit).toBeEnabled();
    await page.reload();
    await expect(restore).toBeEnabled();
    await expect(remove).not.toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${name}`,
        exact: true,
      }),
    ).toHaveText("3 kg");
  } finally {
    addGate.resolve();
    removeGate.resolve();
    await page.unrouteAll({ behavior: "wait" });
    await db.ownItem.delete({ where: { id: ownItem.id } });
  }
});
