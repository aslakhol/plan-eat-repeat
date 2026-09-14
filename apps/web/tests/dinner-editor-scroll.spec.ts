import { expect, test } from "@playwright/test";
import { deleteDinnerIfPresent, ensureSignedIn } from "./capture-support";

test("save stays at the bottom while scrolling a long recipe in the dinner dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const dinnerName = `Scrolling recipe ${Date.now()}`;
  await ensureSignedIn(page);
  try {
    await page.goto("/dinners/new?origin=cookbook&mode=manual");
    await page
      .getByRole("textbox", { name: "Name", exact: true })
      .fill(dinnerName);
    await page.getByRole("button", { name: "Add recipe", exact: true }).click();
    await page.getByRole("button", { name: "Add step", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Step 1", exact: true })
      .fill(
        Array.from(
          { length: 30 },
          (_, index) => `${index + 1}. Stir the soup.`,
        ).join("\n"),
      );
    const saveButton = page.getByRole("button", {
      name: "Save dinner",
      exact: true,
    });
    await saveButton.click();
    await expect(page).toHaveURL(/\/dinners\/\d+$/);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(saveButton).toBeInViewport({ ratio: 1 });
    const savePosition = () =>
      saveButton.evaluate((button) => button.getBoundingClientRect().top);
    const initialSavePosition = await savePosition();

    const notes = page.getByRole("textbox", { name: "Notes", exact: true });
    await notes.scrollIntoViewIfNeeded();
    await notes.fill("Serve with bread.");
    await expect.poll(savePosition).toBeCloseTo(initialSavePosition, 0);
    await expect(saveButton).toBeInViewport({ ratio: 1 });
    await saveButton.click();
    await expect(
      page.getByRole("heading", { name: dinnerName, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Serve with bread.", { exact: true }),
    ).toBeVisible();
  } finally {
    await deleteDinnerIfPresent(page, dinnerName);
  }
});
