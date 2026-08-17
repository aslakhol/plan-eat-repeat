import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import { findPublishedDinnerSaveCount } from "./published-dinner";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");
const testDb = createPrismaClient(databaseUrl);

void test("Save Count excludes the source Household and counts each destination Household once", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const households = await testDb.$transaction(
    ["source", "first-destination", "second-destination"].map((kind, index) =>
      testDb.household.create({
        data: {
          name: `${kind} ${uniqueId}`,
          slug: `save-count-${kind}-${uniqueId}-${index}`,
        },
      }),
    ),
  );
  const [sourceHousehold, firstDestination, secondDestination] = households;
  assert.ok(sourceHousehold);
  assert.ok(firstDestination);
  assert.ok(secondDestination);
  const source = await testDb.dinner.create({
    data: {
      name: `Source Dinner ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: `save-count-${uniqueId}`,
      publishedAt: new Date(),
    },
  });

  try {
    await testDb.dinner.createMany({
      data: [
        {
          name: `Own copy ${uniqueId}`,
          householdId: sourceHousehold.id,
          sourceDinnerId: source.id,
        },
        {
          name: `First copy ${uniqueId}`,
          householdId: firstDestination.id,
          sourceDinnerId: source.id,
        },
        {
          name: `Second copy ${uniqueId}`,
          householdId: firstDestination.id,
          sourceDinnerId: source.id,
        },
        {
          name: `Third copy ${uniqueId}`,
          householdId: secondDestination.id,
          sourceDinnerId: source.id,
        },
      ],
    });

    assert.equal(
      await findPublishedDinnerSaveCount(testDb, sourceHousehold.id, source.id),
      2,
    );
  } finally {
    await testDb.dinner.deleteMany({
      where: { householdId: { in: households.map(({ id }) => id) } },
    });
    await testDb.household.deleteMany({
      where: { id: { in: households.map(({ id }) => id) } },
    });
    await testDb.$disconnect();
  }
});
