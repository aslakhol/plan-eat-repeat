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

test("add a manual item and recipe ingredients, then take them off the shopping list", async ({
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
              name: ingredientName,
              amount: 200,
              unit: "g",
            },
          },
        },
      },
    },
  });
  const removeItem = (name: string) =>
    page.getByRole("button", { name: `Remove ${name} from list`, exact: true });
  try {
    await page
      .getByRole("link", { name: "Shopping list", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Add an item", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Item name", exact: true })
      .fill(manualName);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Item name", exact: true }),
    ).toBeEmpty();
    await page.keyboard.press("Escape");
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
        name: `Edit quantity for ${ingredientName}`,
        exact: true,
      }),
    ).toHaveText("200 g");
    await removeItem(manualName).click();
    await expect(removeItem(manualName)).toHaveCount(0);
    await removeItem(ingredientName).click();
    await expect(removeItem(ingredientName)).toHaveCount(0);
    await page.reload();
    await expect(removeItem(manualName)).toHaveCount(0);
    await expect(removeItem(ingredientName)).toHaveCount(0);
  } finally {
    await db.shoppingItem.deleteMany({
      where: { householdId, name: { in: [manualName, ingredientName] } },
    });
    await db.dinner.delete({ where: { id: dinner.id } });
  }
});
