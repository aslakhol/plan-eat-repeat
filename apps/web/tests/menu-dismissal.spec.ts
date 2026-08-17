import { expect, type Locator, type Page, test } from "@playwright/test";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

test.use({ hasTouch: true });

async function expectOutsideClickClosesMenu(
  menu: Locator,
  outsideTarget: Locator,
  interaction: "click" | "tap" = "click",
) {
  await menu.locator("summary").click({ timeout: 5_000 });
  await expect(menu).toHaveAttribute("open", "");

  const options = { position: { x: 2, y: 2 }, timeout: 5_000 };
  if (interaction === "tap") {
    await outsideTarget.tap(options);
  } else {
    await outsideTarget.click(options);
  }

  await expect(menu).not.toHaveAttribute("open", "");
}

test("Dinner action menus close when clicking or tapping outside", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);
  const dinnerName = `Menu dismissal ${Date.now()}`;

  try {
    await quickAddDinner(page, dinnerName);

    await test.step("Dinner details", async () => {
      await expectOutsideClickClosesMenu(
        page.locator("details").filter({ hasText: "Dinner actions" }),
        page.getByRole("heading", { name: dinnerName }),
      );
    });

    await test.step("Dinner editor", async () => {
      await page.getByRole("button", { name: "Edit" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit dinner" }),
      ).toBeVisible();
      await expectOutsideClickClosesMenu(
        page.locator("details").filter({ hasText: "Editor actions" }),
        page.getByRole("heading", { name: "Edit dinner" }),
        "tap",
      );
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByRole("heading", { name: "Cookbook" }),
      ).toBeVisible();
      await page.getByRole("link", { name: dinnerName }).click();
      await expect(
        page.getByRole("button", { name: "Plan this dinner" }),
      ).toBeVisible();
    });

    await test.step("Planned Dinner", async () => {
      await page.getByRole("button", { name: "Plan this dinner" }).click();
      const freeDay = page
        .getByRole("button", {
          name: new RegExp(`^Plan ${dinnerName} for `),
        })
        .first();
      await expect(freeDay).toBeVisible();
      const plannedDate = await freeDay
        .locator("time")
        .getAttribute("datetime");
      expect(plannedDate).not.toBeNull();
      await freeDay.click();
      await expect(page.getByRole("status")).toContainText(dinnerName);

      await page.goto(`/?date=${plannedDate}`);
      await expect(page.getByText("Planned Dinner actions")).toBeVisible();
      await expectOutsideClickClosesMenu(
        page.locator("details").filter({
          hasText: "Planned Dinner actions",
        }),
        page.locator("h1").filter({ hasText: dinnerName }),
        "tap",
      );
    });
  } finally {
    await deleteDinnerIfPresent(page, dinnerName);
  }
});
