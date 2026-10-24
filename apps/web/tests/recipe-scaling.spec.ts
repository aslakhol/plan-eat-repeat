import { expect, test } from "@playwright/test";
import { deleteDinnerIfPresent, ensureSignedIn } from "./capture-support";

test("recipe scaling is temporary in Cookbook and Plan", async ({ page }) => {
  test.setTimeout(120_000);
  const name = `Lentil soup ${Date.now()}`;
  await ensureSignedIn(page);
  try {
    await page.goto("/dinners/new?origin=cookbook&mode=manual");
    // The editor appears before Clerk finishes loading on a full navigation.
    await expect(
      page.locator('nav[aria-label="Primary navigation"]'),
    ).toBeAttached();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill(name);
    await page.getByRole("button", { name: "Add recipe", exact: true }).click();
    await page
      .getByRole("spinbutton", { name: "Number of servings" })
      .fill("2");
    for (const [index, ingredient] of [
      "Lentils",
      "Olive oil",
      "Salt",
    ].entries()) {
      await page
        .getByRole("button", { name: "Add ingredient", exact: true })
        .click();
      await page
        .getByLabel(`Ingredient ${index + 1} name`, { exact: true })
        .fill(ingredient);
    }
    await page.getByLabel("Ingredient 1 amount", { exact: true }).fill("200");
    await page.getByLabel("Ingredient 1 unit", { exact: true }).fill("g");
    await page.getByLabel("Ingredient 2 amount", { exact: true }).fill("0.1");
    await page.getByLabel("Ingredient 2 unit", { exact: true }).fill("dl");
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Step 1", exact: true })
      .fill("Simmer for 20 minutes.");
    await page
      .getByRole("button", { name: "Save dinner", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    const dinnerUrl = page.url();
    const recipe = page.locator("article");

    await page.locator("summary").filter({ hasText: "Dinner actions" }).click();
    await page
      .getByRole("button", { name: "Scale recipe", exact: true })
      .click();
    for (let step = 0; step < 4; step += 1) {
      await page.getByRole("button", { name: "Increase recipe scale" }).click();
    }
    await expect(recipe.getByText("600 g", { exact: true })).toBeVisible();
    await expect(recipe.getByText("0.3 dl", { exact: true })).toBeVisible();
    await expect(recipe.getByText("6 servings", { exact: true })).toBeVisible();
    await expect(recipe.getByText("Salt", { exact: true })).toBeVisible();
    await expect(
      recipe.getByText("Simmer for 20 minutes.", { exact: true }),
    ).toBeVisible();

    // Replacing the multiplier always uses the original quantities.
    for (let step = 0; step < 5; step += 1) {
      await page.getByRole("button", { name: "Decrease recipe scale" }).click();
    }
    await expect(
      page.getByRole("button", { name: "Decrease recipe scale" }),
    ).toBeDisabled();
    await expect(recipe.getByText("100 g", { exact: true })).toBeVisible();
    await expect(recipe.getByText("1 serving", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Reset recipe scale", exact: true })
      .click();
    await expect(recipe.getByText("200 g", { exact: true })).toBeVisible();

    await page.locator("summary").filter({ hasText: "Dinner actions" }).click();
    await page
      .getByRole("button", { name: "Scale recipe", exact: true })
      .click();
    for (let step = 0; step < 2; step += 1) {
      await page.getByRole("button", { name: "Increase recipe scale" }).click();
    }
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Number of servings")).toHaveValue("2");
    await expect(
      page.getByLabel("Ingredient 1 amount", { exact: true }),
    ).toHaveValue("200");
    await expect(
      page.getByLabel("Ingredient 2 amount", { exact: true }),
    ).toHaveValue("0.1");
    await page.goto(dinnerUrl);
    await expect(recipe.getByText("200 g", { exact: true })).toBeVisible();

    await page
      .getByRole("button", { name: "Plan this dinner", exact: true })
      .click();
    await page
      .getByRole("button", { name: new RegExp(`^Plan ${name} for `) })
      .first()
      .click();
    await expect(page).toHaveURL(/\/dinners$/);
    await page.goto("/");
    const plannedDinner = page
      .getByTestId("plan-day-trigger")
      .filter({ hasText: name });
    await plannedDinner.click();
    await page
      .locator("summary")
      .filter({ hasText: "Planned Dinner actions" })
      .click();
    await page
      .getByRole("button", { name: "Scale recipe", exact: true })
      .click();
    for (let step = 0; step < 3; step += 1) {
      await page.getByRole("button", { name: "Increase recipe scale" }).click();
    }
    await expect(recipe.getByText("500 g", { exact: true })).toBeVisible();
    await expect(recipe.getByText("5 servings", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await plannedDinner.click();
    await expect(recipe.getByText("200 g", { exact: true })).toBeVisible();
    await expect(recipe.getByText("2 servings", { exact: true })).toBeVisible();
    await page.goto(dinnerUrl);
    await expect(recipe.getByText("200 g", { exact: true })).toBeVisible();
  } finally {
    await deleteDinnerIfPresent(page, name);
  }
});
