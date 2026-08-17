import { expect, type Locator, type Page, test } from "@playwright/test";

import { assertNoHorizontalOverflow, ensureSignedIn } from "./capture-support";

const focusTreatmentExtent = 4;

async function expectUnclippedFocusTreatment(control: Locator) {
  await control.focus();
  await expect(control).toBeFocused();

  const metrics = await control.evaluate((element, extent) => {
    let treatment: Element = element;
    while (
      getComputedStyle(treatment).boxShadow === "none" &&
      treatment.parentElement &&
      treatment.parentElement !== document.body
    ) {
      treatment = treatment.parentElement;
    }

    const treatmentRect = treatment.getBoundingClientRect();
    const clippingAncestors = [];

    for (
      let ancestor = treatment.parentElement;
      ancestor && ancestor !== document.body;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor);
      const clipsX = style.overflowX !== "visible";
      const clipsY = style.overflowY !== "visible";

      if (clipsX || clipsY) {
        const rect = ancestor.getBoundingClientRect();
        clippingAncestors.push({
          clipsX,
          clipsY,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        });
      }
    }

    return {
      boxShadow: getComputedStyle(treatment).boxShadow,
      ring: {
        left: treatmentRect.left - extent,
        right: treatmentRect.right + extent,
        top: treatmentRect.top - extent,
        bottom: treatmentRect.bottom + extent,
      },
      clippingAncestors,
    };
  }, focusTreatmentExtent);

  expect(metrics.boxShadow).not.toBe("none");
  for (const ancestor of metrics.clippingAncestors) {
    if (ancestor.clipsX) {
      expect(metrics.ring.left).toBeGreaterThanOrEqual(ancestor.left);
      expect(metrics.ring.right).toBeLessThanOrEqual(ancestor.right);
    }
    if (ancestor.clipsY) {
      expect(metrics.ring.top).toBeGreaterThanOrEqual(ancestor.top);
      expect(metrics.ring.bottom).toBeLessThanOrEqual(ancestor.bottom);
    }
  }
}

async function expectDinnerFormFocusTreatments(page: Page) {
  await expectUnclippedFocusTreatment(
    page.getByRole("textbox", { name: "Name", exact: true }),
  );
  await expectUnclippedFocusTreatment(
    page.getByRole("textbox", { name: "Link", exact: true }),
  );
  await expectUnclippedFocusTreatment(page.getByPlaceholder("Add tag…"));
  await expectUnclippedFocusTreatment(
    page.getByRole("textbox", { name: "Notes" }),
  );
}

async function expectNoHorizontalOverflowIncludingDrawers(page: Page) {
  await assertNoHorizontalOverflow(page);
  await expect
    .poll(() =>
      page
        .locator("[data-responsive-modal-scroll-viewport]")
        .evaluateAll((viewports) =>
          viewports.every(
            (viewport) => viewport.scrollWidth <= viewport.clientWidth,
          ),
        ),
    )
    .toBe(true);
}

async function expectRecipeRowFocusTreatments(page: Page) {
  await expectUnclippedFocusTreatment(
    page.locator('[aria-label="Ingredient 1 amount"]').first(),
  );
  await expectUnclippedFocusTreatment(
    page.locator('[aria-label="Ingredient 1 unit"]').first(),
  );
  await expectUnclippedFocusTreatment(
    page.locator('[aria-label="Ingredient 1 name"]').first(),
  );
  await expectUnclippedFocusTreatment(
    page.locator('[aria-label="Ingredient 1 note"]').first(),
  );
  await expectUnclippedFocusTreatment(
    page.locator('[aria-label="Step 1"]').first(),
  );
}

test("Dinner form focus treatments stay visible at supported widths", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await ensureSignedIn(page);

  await page.goto("/dinners");
  const recipeDinnerHref = await page
    .getByRole("link", { name: /Chicken Curry/ })
    .first()
    .getAttribute("href");
  expect(recipeDinnerHref).not.toBeNull();

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await test.step(`${viewport.width}x${viewport.height}`, async () => {
      await page.setViewportSize(viewport);

      await page.goto("/");
      await page.getByRole("button", { name: "Add Dinner" }).click();
      await expectUnclippedFocusTreatment(
        page.getByRole("textbox", { name: "Dinner name" }),
      );
      await expectNoHorizontalOverflowIncludingDrawers(page);

      await page.goto("/dinners/new?origin=cookbook&mode=manual");
      await expect(
        page.getByRole("heading", { name: "New dinner" }),
      ).toBeVisible();
      await expectDinnerFormFocusTreatments(page);
      await expectNoHorizontalOverflowIncludingDrawers(page);

      await page.goto(recipeDinnerHref!);
      await page.getByRole("button", { name: "Edit" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit dinner" }),
      ).toBeVisible();
      await expectDinnerFormFocusTreatments(page);
      await expectRecipeRowFocusTreatments(page);
      await expectNoHorizontalOverflowIncludingDrawers(page);
    });
  }
});
