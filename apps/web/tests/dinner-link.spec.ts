import { expect, test } from "@playwright/test";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

test("the Dinner editor normalizes web Links and rejects other schemes", async ({
  page,
}) => {
  const dinnerName = `Dinner Link ${Date.now()}`;

  try {
    await ensureSignedIn(page);
    await quickAddDinner(page, dinnerName);
    await page.getByRole("button", { name: "Edit" }).click();

    const linkInput = page.getByRole("textbox", { name: "Link", exact: true });
    await linkInput.fill("example.com/recipe");
    await page.getByRole("textbox", { name: "Name" }).click();
    await expect(linkInput).toHaveValue("https://example.com/recipe");

    await linkInput.fill("mailto:cook@example.com");
    await page.getByRole("textbox", { name: "Name" }).click();
    await expect(page.getByText("Enter a valid link")).toBeVisible();

    await linkInput.fill("recipes.example.com/tacos");
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(
      page.getByRole("textbox", { name: "Link", exact: true }),
    ).toHaveValue("https://recipes.example.com/tacos");
  } finally {
    await deleteDinnerIfPresent(page, dinnerName);
  }
});
