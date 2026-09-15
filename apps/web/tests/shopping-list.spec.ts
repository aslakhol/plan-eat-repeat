import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test, type Locator } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

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
  const moveWithoutFlashing = async (
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
      // Keep the row in place until the transfer can be reflected in both lists.
      await expect(action).toBeVisible({ timeout: 500 });
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
      .getByRole("button", { name: "Add an item", exact: true })
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
    await expect(editor.getByRole("alert")).toContainText(
      "Could not save the item",
    );
    await expect(noteInput).toHaveValue("For dinner");
    await page.unroute(saveUrl);
    // Tap the backdrop below the error notification.
    const drawer = await editor.boundingBox();
    if (!drawer) throw new Error("Item drawer not visible");
    await page.mouse.click(5, drawer.y - 10);
    await expect(editor).not.toBeVisible();
    ingredientLabel = `${ingredientName}, For dinner`;
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
    await moveWithoutFlashing(addRecent(), "addRecent");
    await expect(removeItem(ingredientName)).toBeVisible();
    await expect(addRecent()).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: `Edit quantity for ${ingredientLabel}`,
        exact: true,
      }),
    ).toHaveText("300 g");
    await moveWithoutFlashing(removeItem(ingredientName), "remove");
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
    await page.route("**/api/trpc/**", async (route) => {
      if (route.request().url().includes("shoppingList.list")) {
        refreshRequested.resolve();
        await refresh.promise;
      }
      await route.continue();
    });
    try {
      await last.click();
      await refreshRequested.promise;
      await expect(drawer).toBeVisible();
      await expect(last).toBeDisabled();
      await page.keyboard.press("Escape");
      await expect(drawer).not.toBeVisible();
      await open.click();
      await input.fill("Next purchase");
    } finally {
      refresh.resolve();
      await page.unrouteAll({ behavior: "wait" });
    }
    await page.waitForLoadState("networkidle");
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
