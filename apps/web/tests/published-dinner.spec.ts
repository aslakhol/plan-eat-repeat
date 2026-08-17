import { expect, test } from "@playwright/test";

import {
  deleteDinnerIfPresent,
  ensureSignedIn,
  quickAddDinner,
} from "./capture-support";

test("a Cookbook member publishes a Dinner that anyone can read", async ({
  browser,
  page,
}) => {
  await ensureSignedIn(page);
  const dinnerName = `Published Dinner ${Date.now()}`;
  const updatedDinnerName = `${dinnerName} updated`;
  let cleanupName = dinnerName;
  const anonymousContext = await browser.newContext();
  const anonymousPage = await anonymousContext.newPage();

  try {
    await quickAddDinner(page, dinnerName);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(
      page.getByRole("heading", { name: "Share dinner" }),
    ).toBeVisible();
    await expect(page.getByText("Anyone can read this dinner.")).toBeVisible();
    await page.getByRole("button", { name: "Publish dinner" }).click();

    const publicLink = page.getByRole("link", {
      name: "Open published dinner",
    });
    const publicPath = await publicLink.getAttribute("href");
    expect(publicPath).toMatch(/^\/d\/[a-z0-9-]+$/);

    const response = await anonymousPage.goto(publicPath!);
    expect(response?.status()).toBe(200);
    expect(await response?.text()).toContain(dinnerName);
    await expect(
      anonymousPage.getByRole("heading", { name: dinnerName }),
    ).toBeVisible();
    await expect(
      anonymousPage.getByText(/Shared by .+ · \d{1,2} [A-Z][a-z]+/),
    ).toBeVisible();
    await expect(
      anonymousPage.getByRole("link", { name: "Cookbook" }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: dinnerName }).click();
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Name").fill(updatedDinnerName);
    await page.getByLabel("Notes").fill("Now with live public notes.");
    await page.getByRole("button", { name: "Save dinner" }).click();
    cleanupName = updatedDinnerName;

    await anonymousPage.reload();
    await expect(
      anonymousPage.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await expect(
      anonymousPage.getByText("Now with live public notes."),
    ).toBeVisible();
    expect(new URL(anonymousPage.url()).pathname).toBe(publicPath);

    await page.goto(publicPath!);
    await expect(
      page.getByRole("heading", { name: updatedDinnerName }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Cookbook" })).toHaveCount(0);
  } finally {
    await anonymousContext.close();
    await deleteDinnerIfPresent(page, cleanupName);
  }
});
