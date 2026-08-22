import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import { findPublicDinnerList } from "./public-dinner-list";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");
const testDb = createPrismaClient(databaseUrl);

void test("a Public Dinner List exposes only one Household's active Published Dinners", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const publicSlug = `source-household-${uniqueId}`;
  const [sourceHousehold, otherHousehold, inactiveHousehold] =
    await testDb.$transaction(
      [
        { kind: "source", publicSlug },
        { kind: "other", publicSlug: `other-household-${uniqueId}` },
        { kind: "inactive", publicSlug: `inactive-household-${uniqueId}` },
      ].map(({ kind, publicSlug: householdPublicSlug }, index) =>
        testDb.household.create({
          data: {
            name: `${kind} ${uniqueId}`,
            slug: `public-list-${kind}-${uniqueId}-${index}`,
            publicSlug: householdPublicSlug,
          },
        }),
      ),
    );
  assert.ok(sourceHousehold);
  assert.ok(otherHousehold);
  assert.ok(inactiveHousehold);

  const tagValue = `Quick ${uniqueId}`;
  const active = await testDb.dinner.create({
    data: {
      name: `Active Dinner ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: `active-dinner-${uniqueId}`,
      publishedAt: new Date("2026-08-12T23:30:00.000Z"),
      favourite: true,
      notes: "Visible only on the Dinner page",
      tags: { create: { value: tagValue } },
    },
  });
  await testDb.dinner.createMany({
    data: [
      {
        name: `Stopped Dinner ${uniqueId}`,
        householdId: sourceHousehold.id,
        publicSlug: `stopped-dinner-${uniqueId}`,
        publishedAt: null,
      },
      {
        name: `Other Household Dinner ${uniqueId}`,
        householdId: otherHousehold.id,
        publicSlug: `other-dinner-${uniqueId}`,
        publishedAt: new Date("2026-08-13T12:00:00.000Z"),
      },
    ],
  });

  const householdIds = [
    sourceHousehold.id,
    otherHousehold.id,
    inactiveHousehold.id,
  ];

  try {
    assert.deepEqual(await findPublicDinnerList(testDb, publicSlug), {
      publicSlug,
      householdName: sourceHousehold.name,
      dinners: [
        {
          name: active.name,
          publicSlug: active.publicSlug,
          tags: [tagValue],
        },
      ],
    });
    assert.equal(
      await findPublicDinnerList(testDb, inactiveHousehold.publicSlug!),
      null,
    );

    await testDb.household.update({
      where: { id: sourceHousehold.id },
      data: { name: `Renamed ${uniqueId}` },
    });
    assert.deepEqual(await findPublicDinnerList(testDb, publicSlug), {
      publicSlug,
      householdName: `Renamed ${uniqueId}`,
      dinners: [
        {
          name: active.name,
          publicSlug: active.publicSlug,
          tags: [tagValue],
        },
      ],
    });

    await testDb.dinner.update({
      where: { id: active.id },
      data: { publishedAt: null },
    });
    assert.equal(await findPublicDinnerList(testDb, publicSlug), null);
    await testDb.dinner.update({
      where: { id: active.id },
      data: { publishedAt: new Date("2026-08-14T12:00:00.000Z") },
    });
    assert.equal(
      (await findPublicDinnerList(testDb, publicSlug))?.publicSlug,
      publicSlug,
    );
  } finally {
    await testDb.dinner.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await testDb.tag.deleteMany({ where: { value: tagValue } });
    await testDb.household.deleteMany({ where: { id: { in: householdIds } } });
    await testDb.$disconnect();
  }
});
