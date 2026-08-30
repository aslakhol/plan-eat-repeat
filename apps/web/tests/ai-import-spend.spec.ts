import { createRequire } from "node:module";
import { expect, test } from "@playwright/test";

import { createPrismaClient } from "@planeatrepeat/db";

import { ensureSignedIn } from "./capture-support";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for browser tests");

test("System Admin can inspect AI Import Spend across controls and viewport sizes", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1200, height: 900 });
  await ensureSignedIn(page);

  const authResponse = await page.request.post("/api/dev/auth-bypass");
  const auth = (await authResponse.json()) as { userId?: string };
  expect(auth.userId).toBeTruthy();

  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const secondUserId = `spend-browser-${marker}`;
  const secondHouseholdSlug = `spend-browser-${marker}`;
  const primaryHouseholdKey = `primary-household-${marker}`;
  const primaryMembershipKey = `primary-member-${marker}`;
  const secondHouseholdKey = `credits-household-${marker}`;
  const secondMembershipKey = `credits-member-${marker}`;
  const unavailableHouseholdKey = `unavailable-household-${marker}`;
  const unavailableMembershipKey = `unavailable-member-${marker}`;

  try {
    const systemAdminMembership = await db.membership.findUniqueOrThrow({
      where: { userId: auth.userId },
      select: { householdId: true, id: true },
    });
    await db.user.create({ data: { id: secondUserId } });
    const secondHousehold = await db.household.create({
      data: {
        name: "Credits First Household",
        slug: secondHouseholdSlug,
        Members: { create: { userId: secondUserId, role: "MEMBER" } },
      },
      include: { Members: true },
    });
    const secondMembership = secondHousehold.Members[0];
    expect(secondMembership).toBeTruthy();

    const now = new Date();
    const attempts = Array.from({ length: 75 }, (_, index) => {
      const startedAt = new Date(now);
      startedAt.setUTCDate(startedAt.getUTCDate() - index);
      startedAt.setUTCHours(12, 0, 0, 0);
      const unavailable = index % 15 === 0;
      const creditsFirst = !unavailable && index % 2 === 0;
      const source = ["TEXT", "PHOTO", "YOUTUBE", "INSTAGRAM", "LINK"][
        index % 5
      ] as "TEXT" | "PHOTO" | "YOUTUBE" | "INSTAGRAM" | "LINK";
      const usesSupadata = source !== "TEXT" && source !== "PHOTO";

      return {
        source,
        startedAt,
        finishedAt: new Date(startedAt.getTime() + 30_000),
        householdId: unavailable
          ? null
          : creditsFirst
            ? secondHousehold.id
            : systemAdminMembership.householdId,
        membershipId: unavailable
          ? null
          : creditsFirst
            ? secondMembership!.id
            : systemAdminMembership.id,
        householdAttributionKey: unavailable
          ? unavailableHouseholdKey
          : creditsFirst
            ? secondHouseholdKey
            : primaryHouseholdKey,
        membershipAttributionKey: unavailable
          ? unavailableMembershipKey
          : creditsFirst
            ? secondMembershipKey
            : primaryMembershipKey,
        inferenceState: "ESTIMATED" as const,
        inferenceStartedAt: new Date(startedAt.getTime() + 10_000),
        estimatedAiImportCostUsd: creditsFirst ? 0.005 : 0.02,
        supadataOperationsStarted: usesSupadata ? 1 : 0,
        supadataCredits: usesSupadata ? (creditsFirst ? 4 : 1) : 0,
      };
    });
    await db.aiImportAttempt.createMany({ data: attempts });

    const dashboardRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("aiImportSpend.dashboard")) {
        dashboardRequests.push(request.url());
      }
    });
    await page.goto("/system-admin/ai-import-spend");
    await expect(
      page.getByRole("heading", { name: "AI import spend" }),
    ).toBeVisible();

    for (const period of ["7 days", "30 days", "This month", "All time"]) {
      await page.getByRole("button", { name: period, exact: true }).click();
      await expect(
        page.getByText(period, { exact: true }).first(),
      ).toBeVisible();
    }

    const showOlder = page.getByRole("button", {
      name: "Show older daily spend",
    });
    const showNewer = page.getByRole("button", {
      name: "Show newer daily spend",
    });
    await expect(showOlder).toBeEnabled();
    await expect(showNewer).toBeDisabled();
    await showOlder.click();
    await expect(showNewer).toBeEnabled();
    await page.getByRole("button", { name: "7 days", exact: true }).click();
    await page.getByRole("button", { name: "All time", exact: true }).click();
    await expect(showNewer).toBeDisabled();

    const inferenceOrder = await householdOrder(page);
    await page.locator('[data-household-ranking="credits"]').click();
    const creditsOrder = await householdOrder(page);
    expect(creditsOrder).not.toEqual(inferenceOrder);
    expect(
      await page.locator('[data-share-fill^="household-"]').count(),
    ).toBeGreaterThan(0);

    await page
      .locator('[data-household-row][aria-expanded="false"]')
      .first()
      .click();
    await expect(
      page.locator('[data-household-row][aria-expanded="true"]'),
    ).toHaveCount(1);
    const unavailableHousehold = page
      .locator("[data-household-row]")
      .filter({ hasText: "Household unavailable" });
    await expect(unavailableHousehold).toBeVisible();
    await unavailableHousehold.click();
    await expect(page.getByText("Member unavailable")).toBeVisible();

    const day = page.locator("button[title]").first();
    await day.focus();
    await expect(day).toBeFocused();
    await expect(day.locator("[data-tooltip-placement]")).toBeVisible();
    await page
      .locator('[data-measure="attempts"] [data-legend-item="YOUTUBE"]')
      .click();
    await expect(page.getByRole("tooltip")).toBeVisible();

    const requestsBeforeFocus = dashboardRequests.length;
    await page.evaluate(() => {
      let visibilityState: DocumentVisibilityState = "hidden";
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      window.dispatchEvent(new Event("visibilitychange"));
      visibilityState = "visible";
      window.dispatchEvent(new Event("visibilitychange"));
    });
    await expect
      .poll(() => dashboardRequests.length)
      .toBeGreaterThan(requestsBeforeFocus);
    const requestsAfterFocus = dashboardRequests.length;
    await page.waitForTimeout(1_000);
    expect(dashboardRequests).toHaveLength(requestsAfterFocus);

    await page.setViewportSize({ width: 320, height: 700 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await expect(
      page.getByRole("button", { name: "All time", exact: true }),
    ).toBeVisible();
  } finally {
    await db.aiImportAttempt.deleteMany({
      where: {
        householdAttributionKey: {
          in: [
            primaryHouseholdKey,
            secondHouseholdKey,
            unavailableHouseholdKey,
          ],
        },
      },
    });
    await db.household.deleteMany({ where: { slug: secondHouseholdSlug } });
    await db.user.deleteMany({ where: { id: secondUserId } });
    await db.$disconnect();
  }
});

const householdOrder = (page: import("@playwright/test").Page) =>
  page
    .locator("[data-household-row]")
    .evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("data-household-row")),
    );
