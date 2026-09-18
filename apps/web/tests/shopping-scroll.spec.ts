import { createPrismaClient } from "@planeatrepeat/db";
import { devices, expect, test } from "@playwright/test";
import { createRequire } from "node:module";
import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());
const { defaultBrowserType: browserName, ...iphone } = devices["iPhone 13"]!;
test.use({ ...iphone, browserName });

test("adding a shopping item returns to the top in mobile Safari", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Scroll${crypto.randomUUID()}`;
  const name = `${marker} added`;
  try {
    for (let index = 0; index < 20; index++) {
      await db.ownItem.create({
        data: {
          householdId,
          name: `${marker} ${index}`,
          normalizedName: `${marker.toLowerCase()} ${index}`,
          category: "OWN_ITEMS",
          items: { create: {} },
        },
      });
    }
    await page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("link", { name: "Shopping list" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Shopping list", exact: true }),
    ).toBeVisible();
    // Exercise recovery from a displaced list. Desktop WebKit cannot reproduce
    // the real iPhone software keyboard's initial page displacement.
    await page.evaluate(() => window.scrollTo(0, 320));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
    const addButton = page
      .getByRole("navigation", { name: "Primary navigation" })
      .getByRole("button", { name: "Add shopping item" });
    await addButton.tap();
    const sheet = page.getByRole("dialog", {
      name: "Add an item",
      exact: true,
    });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("combobox", { name: "Item name" }).tap();
    await page.keyboard.type(name);
    await sheet.getByRole("option", { name, exact: true }).tap();
    await expect(sheet).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(
      page.getByRole("heading", { name: "Shopping list", exact: true }),
    ).toBeInViewport();
    // A later cancelled sheet must not inherit the previous addition's reset.
    await page.evaluate(() => window.scrollTo(0, 320));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
    await addButton.tap();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(320);
  } finally {
    await db.ownItem.deleteMany({
      where: {
        householdId,
        normalizedName: { startsWith: marker.toLowerCase() },
      },
    });
  }
});
