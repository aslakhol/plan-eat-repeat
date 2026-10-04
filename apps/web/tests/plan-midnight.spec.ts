import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("an open Plan advances to the correct week at local midnight", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const firstDay = page.getByTestId("plan-day-trigger").first();
  const monday = await firstDay.getAttribute("data-date");
  const sunday = new Date(`${monday}T23:59:59`);
  sunday.setDate(sunday.getDate() + 6);
  await page.clock.install({ time: sunday });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(firstDay).toHaveAttribute("data-date", monday!);
  await page.clock.runFor(1001);
  const nextMonday = new Date(sunday);
  nextMonday.setDate(nextMonday.getDate() + 1);
  const expected = `${nextMonday.getFullYear()}-${String(nextMonday.getMonth() + 1).padStart(2, "0")}-${String(nextMonday.getDate()).padStart(2, "0")}`;
  await expect(firstDay).toHaveAttribute("data-date", expected);
  await expect(firstDay).toContainText("Tonight");
});
