import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("incoming Household saves preserve an open prompt draft", async ({
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
  await ensureSignedIn(page);
  const auth = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await auth.json()) as { userId: string };
  const { household } = await db.membership.findUniqueOrThrow({
    where: { userId },
    include: { household: true },
  });
  const householdPrompt =
    "Use Norwegian and infer missing quantities.\n".repeat(80);
  const readSaved = async () =>
    (await db.household.findUniqueOrThrow({ where: { id: household.id } }))
      .importInstructions;
  try {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: householdPrompt },
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
    await page.getByRole("button", { name: "Link", exact: true }).click();
    const toggle = page.getByRole("button", { name: "Prompt", exact: true });
    const reset = page.locator("summary").filter({ hasText: "Reset" });
    const prompt = page.getByRole("textbox", {
      name: "Import Prompt",
      exact: true,
    });
    await toggle.click();
    await expect(prompt).toHaveValue(householdPrompt);
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to app default", exact: true })
      .click();
    const appDefault = await prompt.inputValue();
    expect(appDefault).not.toBe(householdPrompt);
    expect(await readSaved()).toBe(householdPrompt);
    await toggle.click();
    await expect(reset).not.toBeVisible();
    await toggle.click();
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to household", exact: true })
      .click();
    await expect(prompt).toHaveValue(householdPrompt);
    await prompt.fill("");
    await prompt.fill("Keep my open experiment");
    await page
      .getByRole("switch", { name: "Remember prompt", exact: true })
      .click();
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: "Another member's prompt" },
    });
    await Promise.all([
      page.waitForResponse((response) =>
        response.url().includes("household.household"),
      ),
      page.evaluate(() => window.dispatchEvent(new Event("visibilitychange"))),
    ]);
    await expect(prompt).toHaveValue("Keep my open experiment");
    await expect(
      page.getByRole("switch", { name: "Remember prompt", exact: true }),
    ).toHaveAttribute("aria-checked", "true");
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to household", exact: true })
      .click();
    await expect(prompt).toHaveValue("Another member's prompt");
    await page.keyboard.press("Escape");
    await expect(toggle).not.toBeVisible();
    await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await toggle.click();
    await expect(prompt).toHaveValue("Another member's prompt");
    await expect(
      page.getByRole("switch", { name: "Remember prompt", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
  } finally {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: household.importInstructions },
    });
    await db.$disconnect();
  }
});

test("an import retries with the edited prompt and clears its draft after success", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);
  let expectedPrompt = "";
  let requests = 0;
  let succeed = false;
  await page.route("**/api/trpc/dinner.importFrom**", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      "0": { json: { prompt: expectedPrompt, rememberPrompt: true } },
    });
    requests++;
    if (!succeed) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          result: {
            data: {
              json: {
                name: "One-off import draft",
                recipe: { servings: null, parts: [] },
              },
            },
          },
        },
      ]),
    });
  });
  await page.getByRole("button", { name: "Add Dinner", exact: true }).click();

  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Recipe text", exact: true })
    .fill("Boil lentils and season.");
  await page.getByRole("button", { name: "Prompt", exact: true }).click();
  expectedPrompt = "Make Italian fusion.";
  await page
    .getByRole("textbox", { name: "Import Prompt", exact: true })
    .fill(expectedPrompt);
  const remember = page.getByRole("switch", {
    name: "Remember prompt",
    exact: true,
  });
  await remember.click();
  await expect(remember).toHaveAttribute("aria-checked", "true");
  const before = requests;
  await page
    .getByRole("button", { name: "Import recipe", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  expect(requests).toBe(before + 1);

  succeed = true;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/dinners\/new/);
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("One-off import draft");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL("/");
  await page.reload();
  await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByRole("button", { name: "Prompt", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Import Prompt", exact: true }),
  ).not.toHaveValue(expectedPrompt);
  await expect(
    page.getByRole("switch", { name: "Remember prompt", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
});
