import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import {
  findPublicDinnerList,
  findPublicDinnerListSitemapSlugs,
} from "./public-dinner-list";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");
const testDb = createPrismaClient(databaseUrl);

test.after(async () => {
  await testDb.$disconnect();
});

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
      {
        name: `First copy ${uniqueId}`,
        householdId: otherHousehold.id,
        sourceDinnerId: active.id,
      },
      {
        name: `Second copy ${uniqueId}`,
        householdId: otherHousehold.id,
        sourceDinnerId: active.id,
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
          publishedAt: "2026-08-12T23:30:00.000Z",
          saveCount: 1,
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
          publishedAt: "2026-08-12T23:30:00.000Z",
          saveCount: 1,
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
  }
});

void test("the sitemap lists each active Public Dinner List once and restores its stable identity after republishing", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const activePublicSlug = `active-public-list-${uniqueId}`;
  const inactivePublicSlug = `inactive-public-list-${uniqueId}`;
  const privatePublicSlug = `private-public-list-${uniqueId}`;
  const [activeHousehold, inactiveHousehold, privateHousehold] =
    await testDb.$transaction(
      [
        { kind: "active", publicSlug: activePublicSlug },
        { kind: "inactive", publicSlug: inactivePublicSlug },
        { kind: "private", publicSlug: privatePublicSlug },
      ].map(({ kind, publicSlug }, index) =>
        testDb.household.create({
          data: {
            name: `${kind} Household ${uniqueId}`,
            slug: `sitemap-household-${kind}-${uniqueId}-${index}`,
            publicSlug,
          },
        }),
      ),
    );
  assert.ok(activeHousehold);
  assert.ok(inactiveHousehold);
  assert.ok(privateHousehold);

  const activeDinners = await testDb.$transaction(
    ["first", "second"].map((kind) =>
      testDb.dinner.create({
        data: {
          name: `${kind} Published Dinner ${uniqueId}`,
          householdId: activeHousehold.id,
          publicSlug: `${kind}-published-dinner-${uniqueId}`,
          publishedAt: new Date("2026-08-23T12:00:00.000Z"),
        },
      }),
    ),
  );
  await testDb.dinner.createMany({
    data: [
      {
        name: `Stopped Dinner ${uniqueId}`,
        householdId: inactiveHousehold.id,
        publicSlug: `stopped-dinner-${uniqueId}`,
        publishedAt: null,
      },
      {
        name: `Private Dinner ${uniqueId}`,
        householdId: privateHousehold.id,
      },
    ],
  });

  const householdIds = [
    activeHousehold.id,
    inactiveHousehold.id,
    privateHousehold.id,
  ];
  const occurrences = (slugs: string[], publicSlug: string) =>
    slugs.filter((slug) => slug === publicSlug).length;

  try {
    const activeSlugs = await findPublicDinnerListSitemapSlugs(testDb);
    assert.equal(occurrences(activeSlugs, activePublicSlug), 1);
    assert.equal(occurrences(activeSlugs, inactivePublicSlug), 0);
    assert.equal(occurrences(activeSlugs, privatePublicSlug), 0);

    await testDb.dinner.updateMany({
      where: { householdId: activeHousehold.id },
      data: { publishedAt: null },
    });
    assert.equal(
      occurrences(
        await findPublicDinnerListSitemapSlugs(testDb),
        activePublicSlug,
      ),
      0,
    );

    await testDb.dinner.update({
      where: { id: activeDinners[0]!.id },
      data: { publishedAt: new Date("2026-08-24T12:00:00.000Z") },
    });
    assert.equal(
      occurrences(
        await findPublicDinnerListSitemapSlugs(testDb),
        activePublicSlug,
      ),
      1,
    );
  } finally {
    await testDb.dinner.deleteMany({
      where: { householdId: { in: householdIds } },
    });
    await testDb.household.deleteMany({
      where: { id: { in: householdIds } },
    });
  }
});
