import { createPrismaClient } from "@planeatrepeat/db";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import {
  completeLocalAuth,
  ensureSignedIn,
  provisionLocalAuth,
} from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const db = createPrismaClient(process.env.DATABASE_URL);
test.afterAll(async () => db.$disconnect());

const promptInput = (page: Page) =>
  page.getByRole("textbox", { name: "Import Prompt", exact: true });
const rememberSwitch = (page: Page) =>
  page.getByRole("switch", { name: "Remember prompt", exact: true });

async function openPrompt(page: Page, source = "Text") {
  await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
  await page.getByRole("button", { name: source, exact: true }).click();
  await page.getByRole("button", { name: "Prompt", exact: true }).click();
}

test("a prompt draft survives refresh and a fresh page without retaining source inputs", async ({
  page,
  context,
}) => {
  await ensureSignedIn(page);
  await openPrompt(page);
  await promptInput(page).fill("Translate this recipe into Norwegian.");
  await rememberSwitch(page).click();
  await page
    .getByRole("textbox", { name: "Recipe text", exact: true })
    .fill("Boil lentils.");
  await page.reload();
  await openPrompt(page);
  await expect(promptInput(page)).toHaveValue(
    "Translate this recipe into Norwegian.",
  );
  await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "true");
  await expect(
    page.getByRole("textbox", { name: "Recipe text", exact: true }),
  ).toBeEmpty();

  // Closing the document is not an explicit dismissal of the import sheet.
  await page.close();
  const freshPage = await context.newPage();
  await freshPage.goto("/");
  await openPrompt(freshPage, "Link");
  await expect(promptInput(freshPage)).toHaveValue(
    "Translate this recipe into Norwegian.",
  );
  await expect(rememberSwitch(freshPage)).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await promptInput(freshPage).fill("");
  await freshPage.reload();
  await openPrompt(freshPage, "Photos");
  await expect(promptInput(freshPage)).toBeEmpty();
  await expect(rememberSwitch(freshPage)).toHaveAttribute(
    "aria-checked",
    "true",
  );
});

test("explicit dismissal clears the prompt draft for the next import and fresh page", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await openPrompt(page);
  const householdPrompt = await promptInput(page).inputValue();
  await promptInput(page).fill("Only this experiment.");
  await rememberSwitch(page).click();
  await page.reload();
  await openPrompt(page, "Link");
  await expect(promptInput(page)).toHaveValue("Only this experiment.");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.reload();
  await openPrompt(page);
  await expect(promptInput(page)).toHaveValue(householdPrompt);
  await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "false");
});

test("restored resets follow shared changes and successful import cleanup preserves the remembered Household Prompt", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await ensureSignedIn(page);
  const auth = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await auth.json()) as { userId: string };
  const { household } = await db.membership.findUniqueOrThrow({
    where: { userId },
    include: { household: true },
  });
  try {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: "Our Household instructions." },
    });
    await page.reload();
    await openPrompt(page);
    await promptInput(page).fill("My current experiment.");
    await rememberSwitch(page).click();
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: "Another member's instructions." },
    });
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue("My current experiment.");
    const reset = page.locator("summary").filter({ hasText: "Reset" });
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to app default", exact: true })
      .click();
    const appDefault = await promptInput(page).inputValue();
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue(appDefault);
    await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "true");
    await reset.click();
    await page
      .getByRole("button", { name: "Reset to household", exact: true })
      .click();
    await expect(promptInput(page)).toHaveValue(
      "Another member's instructions.",
    );

    await promptInput(page).fill("Our next shared prompt.");
    await page.route("**/api/trpc/dinner.importFromText**", async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        "0": {
          json: { prompt: "Our next shared prompt.", rememberPrompt: true },
        },
      });
      // The router's save behavior is covered by its real-database integration tests.
      await db.household.update({
        where: { id: household.id },
        data: { importInstructions: "Our next shared prompt." },
      });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            result: {
              data: {
                json: {
                  name: "Unsaved prompt experiment",
                  recipe: { servings: null, parts: [] },
                },
              },
            },
          },
        ]),
      });
    });
    await page
      .getByRole("textbox", { name: "Recipe text", exact: true })
      .fill("Boil lentils.");
    await page
      .getByRole("button", { name: "Import recipe", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dinners\/new/);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL("/");
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue("Our next shared prompt.");
    await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "false");
    await page.keyboard.press("Escape");
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue("Our next shared prompt.");
  } finally {
    await db.household.update({
      where: { id: household.id },
      data: { importInstructions: household.importInstructions },
    });
  }
});

test("local drafts stay separate between Households and between members sharing a browser", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await ensureSignedIn(page);
  const auth = await page.request.post("/api/dev/auth-bypass");
  const { userId } = (await auth.json()) as { userId: string };
  const membership = await db.membership.findUniqueOrThrow({
    where: { userId },
  });
  const otherHousehold = await db.household.create({
    data: {
      name: "Prompt draft separation",
      slug: `prompt-draft-${randomUUID()}`,
      importInstructions: "The other Household's prompt.",
    },
  });
  try {
    await openPrompt(page);
    await promptInput(page).fill("My draft in the original Household.");
    await rememberSwitch(page).click();
    await db.membership.update({
      where: { userId },
      data: { householdId: otherHousehold.id },
    });
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue(
      "The other Household's prompt.",
    );
    await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "false");
    await promptInput(page).fill("My draft in the other Household.");
    await db.membership.update({
      where: { userId },
      data: { householdId: membership.householdId },
    });
    await page.reload();
    await openPrompt(page);
    await expect(promptInput(page)).toHaveValue(
      "My draft in the original Household.",
    );
    await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "true");

    await page.evaluate(async () => {
      await (
        window as typeof window & { Clerk: { signOut: () => Promise<void> } }
      ).Clerk.signOut();
    });
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeVisible();
    const other = await provisionLocalAuth(page, "save-intent-existing");
    const previousMembership = await db.membership.findUnique({
      where: { userId: other.userId },
    });
    await db.user.upsert({
      where: { id: other.userId },
      create: { id: other.userId, welcomeSeenAt: new Date() },
      update: { welcomeSeenAt: new Date() },
    });
    await db.membership.upsert({
      where: { userId: other.userId },
      create: {
        userId: other.userId,
        householdId: membership.householdId,
        role: "MEMBER",
      },
      update: { householdId: membership.householdId },
    });
    try {
      await completeLocalAuth(page, other.ticket, "/");
      await openPrompt(page);
      await expect(promptInput(page)).not.toHaveValue(
        "My draft in the original Household.",
      );
      await expect(rememberSwitch(page)).toHaveAttribute(
        "aria-checked",
        "false",
      );
      await promptInput(page).fill("Another member's local draft.");
      await page.reload();
      await openPrompt(page);
      await expect(promptInput(page)).toHaveValue(
        "Another member's local draft.",
      );
    } finally {
      if (previousMembership) {
        await db.membership.update({
          where: { userId: other.userId },
          data: { householdId: previousMembership.householdId },
        });
      } else {
        await db.membership.delete({ where: { userId: other.userId } });
      }
      await page.reload();
    }
  } finally {
    await db.membership.update({
      where: { userId },
      data: { householdId: membership.householdId },
    });
    await db.household.delete({ where: { id: otherHousehold.id } });
  }
});

test("dismissing before Household settings finish loading clears the prior draft", async ({
  page,
}) => {
  await ensureSignedIn(page);
  await openPrompt(page);
  const initialPrompt = await promptInput(page).inputValue();
  await promptInput(page).fill("Dismiss this interrupted experiment.");
  await rememberSwitch(page).click();
  const gate = Promise.withResolvers<void>();
  await page.route("**/api/trpc/**", async (route) => {
    if (route.request().url().includes("household.household"))
      await gate.promise;
    await route.continue();
  });
  try {
    await page.reload();
    await page.getByRole("button", { name: "Add Dinner", exact: true }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Import prompt", exact: true })
        .getByRole("status"),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  } finally {
    gate.resolve();
    await page.unrouteAll({ behavior: "wait" });
  }
  await page.reload();
  await openPrompt(page);
  await expect(promptInput(page)).toHaveValue(initialPrompt);
  await expect(rememberSwitch(page)).toHaveAttribute("aria-checked", "false");
});
