import { SAVED_READS_KEY } from "../src/lib/saved-reads";
import { expect, test } from "@playwright/test";
import { ensureSignedIn } from "./capture-support";

test("opening Plan reads the visible week once before prefetching adjacent weeks", async ({
  page,
}) => {
  await ensureSignedIn(page);
  const reads: string[] = [];
  const opening = Promise.withResolvers<void>();
  let visibleWeek: string | undefined;
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procedures = url.pathname.split("/api/trpc/")[1]!.split(",");
    const inputs = JSON.parse(url.searchParams.get("input") ?? "{}") as Record<
      string,
      { json: { startOfWeek: string } }
    >;
    const weeks = procedures.flatMap((procedure, index) =>
      procedure === "plan.weekOverview"
        ? [inputs[index]!.json.startOfWeek]
        : [],
    );
    reads.push(...weeks);
    if (weeks.length && !visibleWeek) {
      visibleWeek = weeks[0];
      await opening.promise;
    }
    await route.continue();
  });

  try {
    await page.evaluate((key) => localStorage.removeItem(key), SAVED_READS_KEY);
    await page.reload();
    await expect.poll(() => reads.length).toBeGreaterThan(0);
    // Hold the opening response: no adjacent-week prefetch is useful yet.
    expect(reads).toEqual([visibleWeek]);
    opening.resolve();
    await expect(page.getByRole("heading", { name: "Week" })).toBeVisible();
    await expect.poll(() => new Set(reads).size).toBe(3);
    await page.waitForLoadState("networkidle");
    expect(reads.filter((week) => week === visibleWeek)).toHaveLength(1);
    expect(reads).toHaveLength(3);
  } finally {
    opening.resolve();
    await page.unrouteAll({ behavior: "wait" });
  }
});
