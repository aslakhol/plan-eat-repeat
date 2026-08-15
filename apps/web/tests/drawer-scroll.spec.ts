import { expect, type Page, test } from "@playwright/test";

import { ensureSignedIn, openFirstEmptyDay } from "./capture-support";

const openDrawer = async (page: Page, open: (page: Page) => Promise<void>) => {
  await open(page);
  const drawer = page.locator('[data-vaul-drawer][data-state="open"]').last();
  await expect(drawer).toBeVisible();
  await expect(
    drawer.locator("[data-responsive-modal-scroll-viewport]"),
  ).toHaveCount(1);
  await page.waitForTimeout(500);
  return drawer;
};

const visitCookbook = async (page: Page) => {
  await page.goto("/dinners");
  await expect(page.getByRole("heading", { name: "Cookbook" })).toBeVisible();
};

const openFirstDinnerDetails = async (page: Page) => {
  await visitCookbook(page);
  await page.locator('a[href^="/dinners/"]').first().click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
};

const openLongDinnerDetails = async (page: Page) => {
  await visitCookbook(page);
  await page.getByRole("link", { name: /Chicken Curry/ }).click();
  await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
};

const planSlotPickerOpener = {
  name: "Plan Slot picker",
  open: async (page: Page) => {
    await page.goto("/");
    await openFirstEmptyDay(page);
  },
};

const openers = [
  {
    name: "Add Dinner",
    open: async (page: Page) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
      await page.getByRole("button", { name: "Add Dinner" }).click();
      await expect(
        page.getByRole("heading", { name: "Add a dinner" }),
      ).toBeVisible();
    },
  },
  {
    name: "Dinner details",
    open: openFirstDinnerDetails,
  },
  {
    name: "Dinner planning",
    open: async (page: Page) => {
      await openFirstDinnerDetails(page);
      await page.getByRole("button", { name: "Plan this dinner" }).click();
      await expect(
        page
          .getByRole("button", { name: /^(Plan .* for |.* already has )/ })
          .first(),
      ).toBeVisible();
    },
  },
  {
    name: "Cook settings",
    open: async (page: Page) => {
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
      await page.getByRole("button", { name: "Open cook settings" }).click();
      await expect(
        page.getByRole("heading", { name: "Cook settings" }),
      ).toBeVisible();
    },
  },
  planSlotPickerOpener,
  {
    name: "Planned Dinner",
    open: async (page: Page) => {
      await page.goto("/");
      const plannedDay = page
        .getByTestId("plan-day-trigger")
        .filter({ has: page.locator("span.font-serif") })
        .first();
      await expect(plannedDay).toBeVisible();
      await plannedDay.click();
      await expect(page.getByText("Planned Dinner actions")).toBeVisible();
    },
  },
  {
    name: "Cookbook tag filter",
    open: async (page: Page) => {
      await visitCookbook(page);
      await page.getByRole("button", { name: "Filter by tags" }).click();
      await expect(
        page.getByRole("searchbox", { name: "Search tags" }),
      ).toBeVisible();
    },
  },
];

const assertBoundedDrawer = async (drawer: ReturnType<Page["locator"]>) => {
  const drawerMetrics = await drawer.evaluate((element) => {
    const shell = element as HTMLElement;
    const viewport = shell.querySelector<HTMLElement>(
      "[data-responsive-modal-scroll-viewport]",
    );
    const handle = shell.firstElementChild as HTMLElement | null;
    if (!viewport || !handle) throw new Error("Drawer structure is incomplete");

    shell.scrollTop = 0;
    viewport.scrollTop = 0;
    const handleTopBefore = handle.getBoundingClientRect().top;
    viewport.scrollTop = viewport.scrollHeight;
    const handleTopAfter = handle.getBoundingClientRect().top;
    const fillerHeight = Number.parseFloat(
      getComputedStyle(shell, "::after").height,
    );

    return {
      shellClassName: shell.className,
      shellOverflowY: getComputedStyle(shell).overflowY,
      shellScrollTop: shell.scrollTop,
      viewportOverflowY: getComputedStyle(viewport).overflowY,
      viewportRemainingScroll:
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop,
      handleMovement: Math.abs(handleTopAfter - handleTopBefore),
      fillerHeight,
    };
  });

  expect(
    drawerMetrics.shellOverflowY,
    drawerMetrics.shellClassName,
  ).toBe("visible");
  expect(drawerMetrics.shellScrollTop).toBe(0);
  expect(drawerMetrics.viewportOverflowY).toBe("auto");
  expect(drawerMetrics.viewportRemainingScroll).toBeLessThanOrEqual(1);
  expect(drawerMetrics.handleMovement).toBeLessThanOrEqual(1);
  expect(drawerMetrics.fillerHeight).toBeGreaterThan(0);
};

test("all mobile-web drawers keep scrolling inside their content viewport", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await ensureSignedIn(page);

  for (const size of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    for (const surface of openers) {
      await test.step(`${surface.name} at ${size.width}×${size.height}`, async () => {
        const drawer = await openDrawer(page, surface.open);
        await assertBoundedDrawer(drawer);
      });
    }
  }
});

test("whole-content drawers scroll without moving the Vaul shell or handle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await ensureSignedIn(page);
  const drawer = await openDrawer(page, openLongDinnerDetails);
  const viewport = drawer.locator("[data-responsive-modal-scroll-viewport]");

  const viewportScrollMetrics = await viewport.evaluate((element) => {
    const shell = element.closest<HTMLElement>("[data-vaul-drawer]");
    const handle = shell?.firstElementChild as HTMLElement | undefined;
    if (!shell || !handle) throw new Error("Drawer structure is incomplete");

    const handleTop = handle.getBoundingClientRect().top;
    element.scrollTop = element.scrollHeight;
    return {
      scrollTop: element.scrollTop,
      maxScrollTop: element.scrollHeight - element.clientHeight,
      shellScrollTop: shell.scrollTop,
      handleMovement: Math.abs(handle.getBoundingClientRect().top - handleTop),
    };
  });

  expect(viewportScrollMetrics.maxScrollTop).toBeGreaterThan(0);
  expect(viewportScrollMetrics.scrollTop).toBe(
    viewportScrollMetrics.maxScrollTop,
  );
  expect(viewportScrollMetrics.shellScrollTop).toBe(0);
  expect(viewportScrollMetrics.handleMovement).toBeLessThanOrEqual(1);
});

test("fixed controls stay put while Plan Slot choices scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await ensureSignedIn(page);
  const drawer = await openDrawer(page, planSlotPickerOpener.open);
  const viewport = drawer.locator("[data-responsive-modal-scroll-viewport]");
  const search = drawer.getByRole("searchbox", { name: "Search the cookbook" });
  const action = drawer.getByRole("button", { name: "Surprise me!" });
  const before = {
    search: await search.boundingBox(),
    action: await action.boundingBox(),
  };

  const maxScrollTop = await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return element.scrollHeight - element.clientHeight;
  });
  const after = {
    search: await search.boundingBox(),
    action: await action.boundingBox(),
  };

  expect(maxScrollTop).toBeGreaterThan(0);
  expect(after.search?.y).toBeCloseTo(before.search?.y ?? 0, 0);
  expect(after.action?.y).toBeCloseTo(before.action?.y ?? 0, 0);
});

test("desktop dialogs keep DialogContent scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await ensureSignedIn(page);
  await openLongDinnerDetails(page);

  const dialog = page.getByRole("dialog", { name: "Dinner details" });
  await expect(dialog).toBeVisible();
  await expect(
    page.locator('[data-vaul-drawer][data-state="open"]'),
  ).toHaveCount(0);
  await expect(
    dialog.locator("[data-responsive-modal-scroll-viewport]"),
  ).toHaveCount(0);

  const dialogScrollMetrics = await dialog.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    return {
      overflowY: getComputedStyle(element).overflowY,
      scrollTop: element.scrollTop,
      maxScrollTop: element.scrollHeight - element.clientHeight,
    };
  });

  expect(dialogScrollMetrics.overflowY).toBe("auto");
  expect(dialogScrollMetrics.maxScrollTop).toBeGreaterThan(0);
  expect(dialogScrollMetrics.scrollTop).toBe(dialogScrollMetrics.maxScrollTop);
});
