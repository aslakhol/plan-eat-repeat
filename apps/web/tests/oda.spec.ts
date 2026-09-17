import { z } from "zod";
import superjson from "superjson";
import type { RouterOutputs } from "~/utils/api";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("Oda login returns to the list, recovers a transfer after refresh, and leaves unresolved items usable", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const marker = crypto.randomUUID();
  const call = async (method: string, input: unknown) => {
    const response = await page.request.post(
      `/api/trpc/shoppingList.${method}`,
      { data: { json: input } },
    );
    expect(response.ok()).toBeTruthy();
    return response.json() as Promise<unknown>;
  };
  const itemSchema = z.object({
    result: z.object({
      data: z.object({
        json: z.object({ id: z.string(), ownItemId: z.string() }),
      }),
    }),
  });
  const sent = itemSchema.parse(
    await call("addManual", { name: `Milk ${marker}` }),
  ).result.data.json;
  const leftover = itemSchema.parse(
    await call("addManual", { name: `Unresolved ${marker}` }),
  ).result.data.json;
  let transfer: RouterOutputs["oda"]["transfer"] = null;
  const snapshot = [
    { id: sent.id, name: `Milk ${marker}`, state: "MATCHING" as const },
    {
      id: leftover.id,
      name: `Unresolved ${marker}`,
      state: "MATCHING" as const,
    },
  ];
  const startedAt = new Date();
  let cartReads = 0;
  let connected = false;
  let sends = 0;
  try {
    await page.route("**/api/trpc/**", async (route) => {
      const procedures = new URL(route.request().url()).pathname
        .split("/")
        .at(-1)!
        .split(",");
      if (!procedures.some((name) => name.startsWith("oda.")))
        return route.continue();
      const safeUrl = new URL(route.request().url());
      safeUrl.pathname =
        safeUrl.pathname.slice(0, safeUrl.pathname.lastIndexOf("/") + 1) +
        procedures
          .map((name) =>
            name.startsWith("oda.") ? "shoppingList.categories" : name,
          )
          .join(",");
      const original: unknown[] = procedures.every((name) =>
        name.startsWith("oda."),
      )
        ? []
        : ((await (
            await route.fetch({ url: safeUrl.href })
          ).json()) as unknown[]);
      if (procedures.includes("oda.send")) {
        sends += 1;
        transfer = {
          id: crypto.randomUUID(),
          state: "MATCHING",
          stage: "CHOOSING_PRODUCTS",
          startedAt,
          finishedAt: null,
          confirmedProducts: 0,
          totalProducts: 0,
          items: snapshot,
          recoverable: false,
          cartUrl: "https://oda.com/no/cart/",
          message: null,
        };
      }
      if (procedures.includes("oda.recover")) {
        await call("remove", { id: sent.id });
        transfer = {
          id: crypto.randomUUID(),
          state: "COMPLETED",
          stage: "UPDATING_LIST",
          startedAt,
          finishedAt: new Date(),
          confirmedProducts: 1,
          totalProducts: 1,
          items: snapshot.map((item, index) => ({
            ...item,
            state: index === 0 ? "CONFIRMED" : "UNRESOLVED",
          })),
          recoverable: false,
          cartUrl: "https://oda.com/no/cart/",
          message: "Some items could not be sent. They remain on your list.",
        };
      }
      const result = procedures.map((name, index) => {
        if (
          name === "oda.transfer" ||
          name === "oda.send" ||
          name === "oda.recover"
        )
          return { result: { data: superjson.serialize(transfer) } };
        if (name === "oda.status")
          return {
            result: { data: { json: { connected, reconnectRequired: false } } },
          };
        if (name === "oda.connect")
          return {
            result: {
              data: {
                json: {
                  url: `${new URL(page.url()).origin}/controlled-oda-login`,
                },
              },
            },
          };
        if (name === "oda.cart") {
          cartReads += 1;
          return {
            result: { data: { json: { url: "https://oda.com/no/cart/" } } },
          };
        }
        return original[index];
      });
      await route.fulfill({ json: result });
    });
    await page.route("**/controlled-oda-login", async (route) => {
      connected = true;
      await route.fulfill({
        status: 302,
        headers: { location: "/shopping-list?oda=connected" },
      });
    });
    await page.goto("/shopping-list");
    await expect(
      page.getByRole("button", { name: "Connect Oda", exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("region", { name: "Oda transfer progress" }),
    ).not.toBeVisible();
    expect(cartReads).toBe(0);
    await page
      .locator("summary")
      .filter({ hasText: "Shopping list actions" })
      .click();
    await page
      .getByRole("button", { name: "Connect Oda", exact: true })
      .click();
    await expect(page).toHaveURL(/\/shopping-list\?oda=connected$/);
    await expect(
      page.getByRole("heading", { name: "Shopping list", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Dismiss Oda connection message" })
      .click();
    await expect(
      page.getByRole("button", { name: "Send to Oda", exact: true }),
    ).not.toBeVisible();
    expect(cartReads).toBe(0);
    await page
      .locator("summary")
      .filter({ hasText: "Shopping list actions" })
      .click();
    await expect(
      page.getByRole("link", { name: "Open Oda cart" }),
    ).toHaveAttribute("href", "https://oda.com/no/cart/");
    await page
      .context()
      .route("https://oda.com/no/cart/", (route) =>
        route.fulfill({ body: "Controlled Oda cart" }),
      );
    await page
      .getByRole("button", { name: "Send to Oda", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Oda transfer progress" }),
    ).toContainText("Choosing products and quantities");
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Oda transfer progress" }),
    ).toContainText("Choosing products and quantities");
    // Simulate the server reporting an expired request lease on re-entry.
    transfer = {
      id: crypto.randomUUID(),
      state: "MATCHING",
      stage: "CHOOSING_PRODUCTS",
      startedAt,
      finishedAt: null,
      confirmedProducts: 0,
      totalProducts: 0,
      items: snapshot,
      recoverable: true,
      cartUrl: "https://oda.com/no/cart/",
      message: null,
    };
    await page.reload();
    await page
      .getByRole("button", { name: "Recover transfer", exact: true })
      .click();
    expect(sends).toBe(1);
    const list = page.getByRole("list", {
      name: "Shopping items",
      exact: true,
    });
    await expect(
      list.getByText(`Milk ${marker}`, { exact: true }),
    ).not.toBeVisible();
    await expect(
      list.getByText(`Unresolved ${marker}`, { exact: true }),
    ).toBeVisible();
    const popup = page.waitForEvent("popup");
    await page
      .getByRole("region", { name: "Oda transfer progress" })
      .getByRole("link", { name: "Open Oda cart" })
      .click();
    await expect(await popup).toHaveURL("https://oda.com/no/cart/");
    await expect(
      page.getByRole("heading", { name: "Shopping list", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Dismiss Oda result" }).click();
    await expect(
      page.getByRole("region", { name: "Oda transfer progress" }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: `Edit Unresolved ${marker}`, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
  } finally {
    test.setTimeout(test.info().timeout + 15_000);
    await call("deleteOwnItem", { id: sent.ownItemId });
    await call("deleteOwnItem", { id: leftover.ownItemId });
  }
});
