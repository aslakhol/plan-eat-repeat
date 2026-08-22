import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import { findSharedDinners } from "./published-dinner";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");
const testDb = createPrismaClient(databaseUrl);

void test("a Household receives its active Published Dinners with distinct destination-Cookbook Save Counts", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [sourceHousehold, otherHousehold, firstDestination, secondDestination] =
    await testDb.$transaction(
      ["source", "other", "first-destination", "second-destination"].map(
        (kind, index) =>
          testDb.household.create({
            data: {
              name: `${kind} ${uniqueId}`,
              slug: `shared-dinners-${kind}-${uniqueId}-${index}`,
            },
          }),
      ),
    );
  assert.ok(sourceHousehold);
  assert.ok(otherHousehold);
  assert.ok(firstDestination);
  assert.ok(secondDestination);

  const publishedAt = new Date("2026-08-12T23:30:00.000Z");
  const tagValue = `Quick ${uniqueId}`;
  const active = await testDb.dinner.create({
    data: {
      name: `Active Dinner ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: `active-${uniqueId}`,
      publishedAt,
      tags: { create: { value: tagValue } },
    },
  });
  await testDb.dinner.createMany({
    data: [
      {
        name: `Stopped Dinner ${uniqueId}`,
        householdId: sourceHousehold.id,
        publicSlug: `stopped-${uniqueId}`,
        publishedAt: null,
      },
      {
        name: `Other Household Dinner ${uniqueId}`,
        householdId: otherHousehold.id,
        publicSlug: `other-${uniqueId}`,
        publishedAt,
      },
      {
        name: `First copy ${uniqueId}`,
        householdId: firstDestination.id,
        sourceDinnerId: active.id,
      },
      {
        name: `Duplicate destination copy ${uniqueId}`,
        householdId: firstDestination.id,
        sourceDinnerId: active.id,
      },
      {
        name: `Second copy ${uniqueId}`,
        householdId: secondDestination.id,
        sourceDinnerId: active.id,
      },
    ],
  });

  const householdIds = [
    sourceHousehold.id,
    otherHousehold.id,
    firstDestination.id,
    secondDestination.id,
  ];

  try {
    assert.deepEqual(await findSharedDinners(testDb, sourceHousehold.id), [
      {
        id: active.id,
        name: active.name,
        publicSlug: active.publicSlug,
        publishedAt,
        tags: [{ value: tagValue }],
        saveCount: 2,
      },
    ]);
  } finally {
    await testDb.dinner.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await testDb.tag.deleteMany({ where: { value: tagValue } });
    await testDb.household.deleteMany({ where: { id: { in: householdIds } } });
    await testDb.$disconnect();
  }
});
