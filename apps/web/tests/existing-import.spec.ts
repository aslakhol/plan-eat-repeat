import { expect, test } from "@playwright/test";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

test("existing Dinner import keeps conflicts independent and Cancel preserves persisted data", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);
  const testRun = Date.now();
  const originalName = `Issue 131 import ${testRun}`;
  const importedName = `Imported Issue 131 ${testRun}`;
  const originalSourceLink = "https://ours.example/recipe";
  const importedSourceLink = "https://source.example/recipe";
  const mockedImport = JSON.stringify([
    {
      result: {
        data: {
          json: {
            name: importedName,
            recipe: {
              servings: 4,
              parts: [
                {
                  name: null,
                  ingredients: [
                    {
                      name: "Lentils",
                      amount: 200,
                      unit: "g",
                      note: null,
                    },
                  ],
                  steps: ["Cook the lentils."],
                },
              ],
            },
            sourceUrl: importedSourceLink,
          },
        },
      },
    },
  ]);

  try {
    await quickAddDinner(page, originalName);
    await page.getByRole("button", { name: "Edit" }).click();
    await page
      .getByRole("textbox", { name: "Source Link" })
      .fill(originalSourceLink);
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: mockedImport,
      });
    });

    const importExistingRecipe = async () => {
      await page.getByRole("button", { name: "Edit" }).click();
      await page
        .locator("summary")
        .filter({ hasText: "Editor actions" })
        .click();
      await page.getByRole("button", { name: "Import a recipe…" }).click();
      await page.getByRole("button", { name: "Link" }).click();
      await page
        .getByRole("textbox", { name: "Recipe URL" })
        .fill(importedSourceLink);
      await page.getByRole("button", { name: "Import recipe" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit dinner" }),
      ).toBeVisible();
    };

    await importExistingRecipe();
    await expect(
      page.getByText(`The source calls it “${importedName}”`),
    ).toBeVisible();
    await expect(
      page.getByText(`The source link is “${importedSourceLink}”`),
    ).toBeVisible();
    await page.getByRole("button", { name: "Use theirs" }).first().click();
    await page.getByRole("button", { name: "Keep our link ✓" }).click();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      importedName,
    );
    await expect(
      page.getByRole("textbox", { name: "Source Link" }),
    ).toHaveValue(originalSourceLink);
    await expect(
      page.getByRole("spinbutton", { name: "Number of servings" }),
    ).toHaveValue("4");
    await page.getByRole("button", { name: "Save dinner" }).click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await expect(
      page.locator("h1").filter({ hasText: importedName }),
    ).toBeVisible();

    await importExistingRecipe();
    await expect(
      page.getByRole("button", { name: "Keep our link ✓" }),
    ).toBeVisible();
    page.once("dialog", async (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page).toHaveURL(/\/dinners$/);
    await page.getByRole("link", { name: importedName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue(
      importedName,
    );
    await expect(
      page.getByRole("textbox", { name: "Source Link" }),
    ).toHaveValue(originalSourceLink);
    await expect(
      page.getByRole("spinbutton", { name: "Number of servings" }),
    ).toHaveValue("4");
  } finally {
    await deleteDinnerIfPresent(page, importedName);
    await deleteDinnerIfPresent(page, originalName);
  }
});
