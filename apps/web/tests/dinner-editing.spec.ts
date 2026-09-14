import { expect, test } from "@playwright/test";
import { deleteDinnerIfPresent, ensureSignedIn } from "./capture-support";

test("create a recipe, edit its content, and reload the saved dinner", async ({
  page,
}) => {
  const originalName = `Recipe ${Date.now()}`;
  const editedName = `${originalName} edited`;
  await ensureSignedIn(page);
  try {
    await page.goto("/dinners/new?origin=cookbook&mode=manual");
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(originalName);
    await page
      .getByRole("textbox", { name: "Link", exact: true })
      .fill("example.com/soup");
    await page
      .getByRole("textbox", { name: "Notes", exact: true })
      .fill("Serve with bread.");
    await page.getByRole("button", { name: "Add recipe", exact: true }).click();
    await page
      .getByRole("spinbutton", { name: "Number of servings" })
      .fill("2");
    await page
      .getByRole("button", { name: "Add ingredient", exact: true })
      .click();
    await page.getByLabel("Ingredient 1 name", { exact: true }).fill("Lentils");
    await page
      .getByRole("textbox", { name: "Ingredient 1 amount", exact: true })
      .fill("200");
    await page.getByLabel("Ingredient 1 unit", { exact: true }).fill("g");
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Step 1", exact: true })
      .fill("Simmer until tender.");
    await page
      .getByRole("button", { name: "Save dinner", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: originalName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Simmer until tender.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Ingredient 1 amount", exact: true }),
    ).toHaveValue("200");
    await expect(
      page.getByRole("textbox", { name: "Link", exact: true }),
    ).toHaveValue("https://example.com/soup");
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(editedName);
    await page
      .getByRole("textbox", { name: "Ingredient 1 amount", exact: true })
      .fill("300");
    await page
      .getByRole("textbox", { name: "Notes", exact: true })
      .fill("Make extra for lunch.");
    await page
      .getByRole("button", { name: "Save dinner", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: editedName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Make extra for lunch.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Ingredient 1 amount", exact: true }),
    ).toHaveValue("300");
    await expect(
      page.getByRole("textbox", { name: "Step 1", exact: true }),
    ).toHaveValue("Simmer until tender.");
  } finally {
    await deleteDinnerIfPresent(page, editedName);
    await deleteDinnerIfPresent(page, originalName);
  }
});
