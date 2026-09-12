import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("every source offers the complete prompt, resets, and Remember without losing an open experiment", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
  for (const source of [
    "Link",
    "YouTube video",
    "Instagram",
    "Photos",
    "Text",
  ]) {
    await page.getByRole("button", { name: source, exact: true }).click();
    const toggle = page.getByRole("button", { name: "Prompt", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(
      page.locator("summary").filter({ hasText: "Reset" }),
    ).toBeVisible();
    await toggle.click();
    const prompt = page.getByRole("textbox", {
      name: "Import Prompt",
      exact: true,
    });
    await expect(prompt).toHaveAttribute("maxlength", "20000");
    await expect(prompt).not.toHaveValue("");
    await prompt.fill("Make Italian fusion.");
    await expect(
      page.getByRole("switch", { name: "Remember prompt", exact: true }),
    ).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(prompt).toHaveValue("Make Italian fusion.");
    await page
      .getByRole("button", { name: "‹ Add a dinner", exact: true })
      .click();
  }
});

test("reset styling follows the Household while incoming saves preserve an open textbox", async ({
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
    const card = page.getByRole("region", {
      name: "Import prompt",
      exact: true,
    });
    const toggle = page.getByRole("button", { name: "Prompt", exact: true });
    const reset = page.locator("summary").filter({ hasText: "Reset" });
    const prompt = page.getByRole("textbox", {
      name: "Import Prompt",
      exact: true,
    });
    await expect(card).not.toHaveClass(/border-primary/);
    await toggle.click();
    await expect(prompt).toHaveValue(householdPrompt);
    const height = await prompt.evaluate((el) => ({
      client: el.clientHeight,
      scroll: el.scrollHeight,
    }));
    expect(height.scroll).toBeGreaterThan(height.client);
    expect(height.client).toBeLessThanOrEqual(320);
    await page.screenshot({ path: "/tmp/issue-231-prompt-open.png" });
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to app default", exact: true })
      .click();
    const appDefault = await prompt.inputValue();
    expect(appDefault).not.toBe(householdPrompt);
    expect(await readSaved()).toBe(householdPrompt);
    await expect(card).toHaveClass(/border-primary/);
    await toggle.click();
    await expect(card).toHaveClass(/border-primary/);
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to household", exact: true })
      .click();
    await expect(card).not.toHaveClass(/border-primary/);
    await toggle.click();
    await expect(prompt).toHaveValue(householdPrompt);
    await prompt.fill("");
    await expect(card).toHaveClass(/border-primary/);
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
    await expect(card).not.toHaveClass(/border-primary/);
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

test("all sources submit the edited prompt and Remember through failures, retries, and a successful unsaved import", async ({
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
  for (const source of [
    "Link",
    "YouTube video",
    "Instagram",
    "Photos",
    "Text",
  ]) {
    await page.getByRole("button", { name: source, exact: true }).click();
    if (source === "Photos") {
      await page
        .getByLabel("Choose recipe photos", { exact: true })
        .setInputFiles({
          name: "recipe.png",
          mimeType: "image/png",
          buffer: Buffer.from(
            await page.evaluate(() => {
              const canvas = document.createElement("canvas");
              canvas.width = 10;
              canvas.height = 10;
              return canvas.toDataURL("image/png").split(",")[1]!;
            }),
            "base64",
          ),
        });
      await expect(page.getByAltText("Recipe photo 1 of 1")).toBeVisible();
    } else if (source === "Text") {
      await page
        .getByRole("textbox", { name: "Recipe text", exact: true })
        .fill("Boil lentils and season.");
    } else {
      await page
        .getByRole("textbox", { name: "Recipe URL", exact: true })
        .fill(
          source === "YouTube video"
            ? "https://www.youtube.com/watch?v=BoFkDmTm2uc"
            : source === "Instagram"
              ? "https://www.instagram.com/reel/DOybkebkcaw/"
              : "https://example.com/soup",
        );
    }
    await page.getByRole("button", { name: "Prompt", exact: true }).click();
    expectedPrompt = `Make ${source} Italian fusion.`;
    await page
      .getByRole("textbox", { name: "Import Prompt", exact: true })
      .fill(expectedPrompt);
    const remember = page.getByRole("switch", {
      name: "Remember prompt",
      exact: true,
    });
    if (source === "Link") await remember.click();
    await expect(remember).toHaveAttribute("aria-checked", "true");
    const before = requests;
    await page
      .getByRole("button", { name: "Import recipe", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    expect(requests).toBe(before + 1);
    if (source === "Text") {
      succeed = true;
      await page
        .getByRole("button", { name: "Try again", exact: true })
        .click();
      await expect(page).toHaveURL(/\/dinners\/new/);
      await expect(
        page.getByRole("textbox", { name: "Name", exact: true }),
      ).toHaveValue("One-off import draft");
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page).toHaveURL("/");
      break;
    }
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("button", { name: "Prompt", exact: true }).click();
    await expect(
      page.getByRole("textbox", { name: "Import Prompt", exact: true }),
    ).toHaveValue(expectedPrompt);
    await page
      .getByRole("button", { name: "‹ Add a dinner", exact: true })
      .click();
  }
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
