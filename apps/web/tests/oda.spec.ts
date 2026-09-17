import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("Oda login returns to the Shopping List and opens its cart", async ({
  page,
}) => {
  await ensureSignedIn(page);
  let connected = false;
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
    const result = procedures.map((name, index) => {
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
      if (name === "oda.cart")
        return {
          result: { data: { json: { url: "https://oda.com/no/cart/" } } },
        };
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
  await page.goto("/settings");
  await page.getByRole("button", { name: "Connect Oda", exact: true }).click();
  await expect(page).toHaveURL(/\/shopping-list\?oda=connected$/);
  await expect(
    page.getByRole("heading", { name: "Shopping list", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open Oda cart" }),
  ).toHaveAttribute("href", "https://oda.com/no/cart/");
  await page
    .context()
    .route("https://oda.com/no/cart/", (route) =>
      route.fulfill({ body: "Controlled Oda cart" }),
    );
  const popup = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Open Oda cart" }).click();
  await expect(await popup).toHaveURL("https://oda.com/no/cart/");
  await expect(
    page.getByRole("heading", { name: "Shopping list", exact: true }),
  ).toBeVisible();
});
