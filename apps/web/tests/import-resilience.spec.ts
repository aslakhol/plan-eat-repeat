import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("cancelling and failing an import preserve the submitted link for recovery", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });
  await ensureSignedIn(page);
  const gate = Promise.withResolvers<void>();
  await page.route("**/api/trpc/dinner.importFromUrl**", async (route) => {
    await gate.promise;
    await route.abort();
  });
  try {
    await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    const url = page.getByRole("textbox", { name: "Recipe URL" });
    const submit = page.getByRole("button", {
      name: "Import recipe",
      exact: true,
    });
    await url.fill("https://example.com/recipe");
    await submit.click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    gate.resolve();
    await expect(url).toHaveValue("https://example.com/recipe");
    await submit.click();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(url).toHaveValue("https://example.com/recipe");
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" });
  }
});
