import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("Settings resets only the textbox and protects unsaved changes when leaving", async ({
  page,
}) => {
  page.setDefaultTimeout(10_000);
  await ensureSignedIn(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const prompt = page.getByRole("textbox", {
    name: "Household Prompt",
    exact: true,
  });
  await expect(prompt).toBeVisible();
  const saved = await prompt.inputValue();
  expect(saved.length).toBeGreaterThan(0);
  await expect(prompt).toHaveAttribute("maxlength", "20000");
  await expect(
    page.getByRole("button", { name: "Reset to household", exact: true }),
  ).toBeVisible();
  await prompt.fill("Make Italian fusion.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.goBack({ timeout: 3_000 }).catch(() => undefined);
  await expect(page).toHaveURL(/\/settings$/);
  await expect(prompt).toHaveValue("Make Italian fusion.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("link", { name: "Cookbook", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(prompt).toHaveValue("Make Italian fusion.");
  await page
    .getByRole("button", { name: "Reset to household", exact: true })
    .click();
  await expect(prompt).toHaveValue(saved);
  let dialogs = 0;
  page.on("dialog", async (dialog) => {
    dialogs++;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Cookbook", exact: true }).click();
  await expect(page).toHaveURL(/\/dinners$/);
  expect(dialogs).toBe(0);
});

test("Settings saves full prompts, resets without persistence, and retains edits after a failed save or another member's update", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { createRequire } = await import("node:module");
  const { loadEnvConfig } = createRequire(import.meta.url)(
    "@next/env",
  ) as typeof import("@next/env");
  loadEnvConfig(process.cwd());
  const { createPrismaClient } = await import("@planeatrepeat/db");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const db = createPrismaClient(process.env.DATABASE_URL);
  page.setDefaultTimeout(10_000);
  await ensureSignedIn(page);
  const authResponse = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await authResponse.json()) as { userId: string };
  const { household } = await db.membership.findUniqueOrThrow({
    where: { userId },
    include: { household: true },
  });
  const savedPrompt = "Write Italian fusion recipes.\n".repeat(100);
  const readSaved = async () =>
    (await db.household.findUniqueOrThrow({ where: { id: household.id } }))
      .importInstructions;
  try {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: savedPrompt },
    });
    await page.goto("/settings");
    const prompt = page.getByRole("textbox", {
      name: "Household Prompt",
      exact: true,
    });
    const save = page.getByRole("button", {
      name: "Save changes",
      exact: true,
    });
    await expect(prompt).toHaveValue(savedPrompt);
    const dimensions = await prompt.evaluate((el) => ({
      height: el.clientHeight,
      scroll: el.scrollHeight,
    }));
    expect(dimensions.height).toBeLessThanOrEqual(400);
    expect(dimensions.scroll).toBeGreaterThan(dimensions.height);
    await page
      .getByRole("button", { name: "Reset to app default", exact: true })
      .click();
    const appDefault = await prompt.inputValue();
    expect(appDefault).not.toBe(savedPrompt);
    expect(await readSaved()).toBe(savedPrompt);
    await page
      .getByRole("button", { name: "Reset to household", exact: true })
      .click();
    await expect(prompt).toHaveValue(savedPrompt);
    await prompt.fill("My unsaved experiment");
    await page.route("**/api/trpc/household.updateHousehold**", (route) =>
      route.abort(),
    );
    await save.click();
    await expect(
      page.getByText("Couldn't save household", { exact: true }),
    ).toBeVisible();
    await expect(prompt).toHaveValue("My unsaved experiment");
    expect(await readSaved()).toBe(savedPrompt);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Sign Out", exact: true }).click();
    await expect(prompt).toHaveValue("My unsaved experiment");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await page.unroute("**/api/trpc/household.updateHousehold**");

    // Simulate another member's explicit save and a normal query refresh.
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: "Another member's prompt" },
    });
    await Promise.all([
      page.waitForResponse(
        (response) => response.url().includes("household.household"),
        { timeout: 10_000 },
      ),
      page.evaluate(() => window.dispatchEvent(new Event("visibilitychange"))),
    ]);
    await expect(prompt).toHaveValue("My unsaved experiment");
    await save.click();
    await expect.poll(readSaved).toBe("My unsaved experiment");
    let dialogs = 0;
    const dismiss = async (dialog: import("@playwright/test").Dialog) => {
      dialogs++;
      await dialog.dismiss();
    };
    page.on("dialog", dismiss);
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await expect(page).toHaveURL(/\/dinners$/);
    expect(dialogs).toBe(0);
    page.off("dialog", dismiss);

    await page.goto("/settings");
    await expect(prompt).toHaveValue("My unsaved experiment");
    await page
      .getByRole("button", { name: "Reset to app default", exact: true })
      .click();
    await expect(prompt).toHaveValue(appDefault);
    await save.click();
    await expect.poll(readSaved).toBeNull();
    await expect(save).toBeEnabled();
    await prompt.fill(" \n\t ");
    await save.click();
    await expect(prompt).toHaveValue(appDefault);
    expect(await readSaved()).toBeNull();
    await prompt.fill("Unsaved before refresh");
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.reload({ timeout: 3_000 }).catch(() => undefined);
    await expect(prompt).toHaveValue("Unsaved before refresh");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("link", { name: "Cookbook", exact: true }).click();
    await expect(page).toHaveURL(/\/dinners$/);
  } finally {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: household.importInstructions },
    });
    await db.$disconnect();
  }
});
