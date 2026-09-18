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

test("shopping drawer keeps the page in place and restores its opening control", async ({
  page,
}) => {
  // Playwright sets the iPhone user agent but retains the host platform.
  // Vaul uses navigator.platform to enable its iOS keyboard scroll protection.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "platform", { get: () => "iPhone" });
  });
  await ensureSignedIn(page);
  const response = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await response.json()) as { userId: string };
  const { householdId } = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const marker = `Drawer${crypto.randomUUID()}`;
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
    const navigation = page.getByRole("navigation", {
      name: "Primary navigation",
    });
    await navigation.getByRole("link", { name: "Shopping list" }).click();
    const heading = page.getByRole("heading", {
      name: "Shopping list",
      exact: true,
      includeHidden: true,
    });
    await expect(
      page.getByRole("button", { name: `Edit ${marker} 0`, exact: true }),
    ).toBeAttached();
    const sheet = page.getByRole("dialog", {
      name: "Add an item",
      exact: true,
    });
    const input = sheet.getByRole("combobox", { name: "Item name" });

    for (const scrollY of [0, 320]) {
      const trigger =
        scrollY === 0
          ? page.getByRole("button", { name: "Add an item", exact: true })
          : navigation.getByRole("button", { name: "Add shopping item" });
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(scrollY);
      const headingTop = await heading.evaluate((el) =>
        Math.round(el.getBoundingClientRect().top),
      );
      await trigger.tap();
      await expect(input).toBeVisible();
      await expect(input).not.toBeFocused();
      await input.tap();
      const name = `${marker} added ${scrollY}`;
      await input.fill(name);
      // Desktop WebKit has no software keyboard. Attempt the page displacement
      // that Safari can cause when focusing an input; the drawer must prevent it.
      await page.evaluate(() => window.scrollTo(0, 200));
      await expect
        .poll(() =>
          heading.evaluate((el) => Math.round(el.getBoundingClientRect().top)),
        )
        .toBe(headingTop);
      if (scrollY === 0) await input.press("Enter");
      else await sheet.getByRole("option", { name, exact: true }).tap();
      await expect(sheet).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(scrollY);
      await expect(
        page.getByRole("button", {
          name: `Remove ${name} from list`,
          exact: true,
        }),
      ).toBeAttached();

      await trigger.tap();
      await expect(input).toHaveValue("");
      await input.tap();
      await input.fill("Discard this draft");
      await page.keyboard.press("Escape");
      await expect(sheet).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await expect
        .poll(() => page.evaluate(() => window.scrollY))
        .toBe(scrollY);
    }
  } finally {
    await db.ownItem.deleteMany({
      where: {
        householdId,
        normalizedName: { startsWith: marker.toLowerCase() },
      },
    });
  }
});
