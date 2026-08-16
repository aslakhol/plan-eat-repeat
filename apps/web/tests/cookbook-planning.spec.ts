import { expect, test } from "@playwright/test";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

test("Cookbook planning, Favourite ordering, and deletion remain coherent", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);
  const testRun = Date.now();
  const firstDinnerName = `Issue 131 A ${testRun}`;
  const secondDinnerName = `Issue 131 B ${testRun}`;

  try {
    await quickAddDinner(page, firstDinnerName);
    await page.getByRole("button", { name: "Plan this dinner" }).click();
    const firstFreeDay = page
      .getByRole("button", {
        name: new RegExp(`^Plan ${firstDinnerName} for `),
      })
      .first();
    await expect(firstFreeDay).toBeVisible();
    const plannedDate = (
      await firstFreeDay.getAttribute("aria-label")
    )?.replace(`Plan ${firstDinnerName} for `, "");
    expect(plannedDate).toBeTruthy();
    await firstFreeDay.click();
    await expect(page.getByRole("status")).toContainText(
      `${firstDinnerName} → ${plannedDate}`,
    );
    await expect(page.getByRole("status")).not.toContainText("Undo");

    await quickAddDinner(page, secondDinnerName);
    const dinnerActions = page
      .locator("summary")
      .filter({ hasText: "Dinner actions" });
    await dinnerActions.click();
    await page.getByRole("button", { name: "Add to favourites" }).click();
    await expect(
      page.locator("article").getByText("Favourite", { exact: true }),
    ).toBeAttached();
    await dinnerActions.click();
    await expect(
      page.getByRole("button", { name: "Remove from favourites" }),
    ).toBeVisible();
    await dinnerActions.click();
    await page.getByRole("button", { name: "Plan this dinner" }).click();
    const takenDay = page.getByRole("button", {
      name: `${plannedDate} already has ${firstDinnerName}`,
    });
    await expect(takenDay).toBeVisible();
    await takenDay.click();
    await expect(
      page.getByText(`already has ${firstDinnerName}`),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Keep it" })).toBeVisible();
    await page.getByRole("button", { name: "Replace" }).click();
    await expect(page.getByRole("status")).toContainText(
      `${secondDinnerName} → ${plannedDate}`,
    );
    await expect(page.getByRole("status")).not.toContainText("Undo");

    await page.getByRole("button", { name: "Favourites" }).click();
    await expect(page.getByText("Most planned", { exact: true })).toBeVisible();
    const orderedDinnerNames = await page
      .locator('a[href^="/dinners/"]')
      .allTextContents();
    const firstDinnerIndex = orderedDinnerNames.findIndex((text) =>
      text.includes(firstDinnerName),
    );
    const secondDinnerIndex = orderedDinnerNames.findIndex((text) =>
      text.includes(secondDinnerName),
    );
    expect(firstDinnerIndex).toBeGreaterThanOrEqual(0);
    expect(secondDinnerIndex).toBeGreaterThanOrEqual(0);
    expect(secondDinnerIndex).toBeLessThan(firstDinnerIndex);

    await page.getByRole("link", { name: secondDinnerName }).click();
    await dinnerActions.click();
    await page.getByRole("button", { name: "Delete dinner" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete dinner" });
    await expect(deleteDialog).toContainText("Cooking History");
    await expect(
      deleteDialog.getByText(plannedDate!.replace(/^[^,]+, /, "")),
    ).toBeVisible();
    const confirmDelete = deleteDialog.getByRole("button", {
      name: "Delete",
      exact: true,
    });
    await expect(confirmDelete).toBeEnabled();
    await confirmDelete.click();
    await expect(page).toHaveURL(/\/dinners$/);
    await expect(
      page.getByRole("link", { name: secondDinnerName }),
    ).not.toBeVisible();
    await page.goto("/");
    await expect(page.getByText(secondDinnerName, { exact: true })).toHaveCount(
      0,
    );
  } finally {
    await deleteDinnerIfPresent(page, secondDinnerName);
    await deleteDinnerIfPresent(page, firstDinnerName);
  }
});
