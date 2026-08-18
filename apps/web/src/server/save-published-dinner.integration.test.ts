import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

import { savePublishedDinnerForUser } from "./save-published-dinner";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");
const testDb = createPrismaClient(databaseUrl);

void test("a Save Intent bootstraps a database User, one-person Household, Membership, and copy in one save", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `save-intent-user-${uniqueId}`;
  const sourceHousehold = await testDb.household.create({
    data: {
      name: `Source Household ${uniqueId}`,
      slug: `save-intent-source-${uniqueId}`,
    },
  });
  const source = await testDb.dinner.create({
    data: {
      name: `Source Dinner ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: `save-intent-${uniqueId}`,
      publishedAt: new Date(),
    },
  });

  try {
    assert.equal(await testDb.user.findUnique({ where: { id: userId } }), null);

    const result = await savePublishedDinnerForUser(
      testDb,
      {
        id: userId,
        firstName: "Ada",
        lastName: "Lovelace",
        imageUrl: "https://example.com/ada.png",
      },
      source.publicSlug!,
    );

    assert.equal(result?.createdNewCopy, true);
    const membership = await testDb.membership.findUniqueOrThrow({
      where: { userId },
      include: { household: true, user: true },
    });
    assert.equal(membership.role, "ADMIN");
    assert.equal(membership.household.name, "Ada Lovelace's household");
    assert.equal(membership.user.firstName, "Ada");
    assert.equal(membership.user.lastName, "Lovelace");
    assert.equal(
      await testDb.membership.count({
        where: { householdId: membership.householdId },
      }),
      1,
    );
    assert.deepEqual(
      await testDb.dinner.findUniqueOrThrow({
        where: { id: result.dinner.id },
        select: { householdId: true, sourceDinnerId: true, name: true },
      }),
      {
        householdId: membership.householdId,
        sourceDinnerId: source.id,
        name: source.name,
      },
    );
  } finally {
    const membership = await testDb.membership.findUnique({
      where: { userId },
      select: { householdId: true },
    });
    await testDb.user.deleteMany({ where: { id: userId } });
    if (membership) {
      await testDb.dinner.deleteMany({
        where: { householdId: membership.householdId },
      });
      await testDb.household.deleteMany({
        where: { id: membership.householdId },
      });
    }
    await testDb.dinner.deleteMany({ where: { id: source.id } });
    await testDb.household.deleteMany({ where: { id: sourceHousehold.id } });
  }
});

void test("Save Intent retries use an existing Household and copy the latest server content once", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `save-intent-existing-${uniqueId}`;
  const sourceHousehold = await testDb.household.create({
    data: {
      name: `Source Household ${uniqueId}`,
      slug: `save-intent-existing-source-${uniqueId}`,
    },
  });
  const destinationHousehold = await testDb.household.create({
    data: {
      name: `Existing Household ${uniqueId}`,
      slug: `save-intent-existing-destination-${uniqueId}`,
      Members: {
        create: {
          role: "ADMIN",
          user: { create: { id: userId, firstName: "Grace" } },
        },
      },
    },
  });
  const source = await testDb.dinner.create({
    data: {
      name: `Before authentication ${uniqueId}`,
      notes: "Old notes",
      householdId: sourceHousehold.id,
      publicSlug: `save-intent-existing-${uniqueId}`,
      publishedAt: new Date(),
    },
  });

  try {
    await testDb.dinner.update({
      where: { id: source.id },
      data: { name: `After authentication ${uniqueId}`, notes: "Latest notes" },
    });

    const [first, retry] = await Promise.all([
      savePublishedDinnerForUser(
        testDb,
        { id: userId, firstName: "Grace", lastName: null, imageUrl: null },
        source.publicSlug!,
      ),
      savePublishedDinnerForUser(
        testDb,
        { id: userId, firstName: "Grace", lastName: null, imageUrl: null },
        source.publicSlug!,
      ),
    ]);

    assert.ok(first);
    assert.ok(retry);
    assert.equal(first.householdId, destinationHousehold.id);
    assert.equal(retry.householdId, destinationHousehold.id);
    assert.equal(
      [first, retry].filter((result) => result.createdNewCopy).length,
      1,
    );
    assert.deepEqual(
      await testDb.dinner.findMany({
        where: {
          householdId: destinationHousehold.id,
          sourceDinnerId: source.id,
        },
        select: { name: true, notes: true },
      }),
      [{ name: `After authentication ${uniqueId}`, notes: "Latest notes" }],
    );
    assert.equal(await testDb.membership.count({ where: { userId } }), 1);
  } finally {
    await testDb.dinner.deleteMany({
      where: {
        householdId: { in: [destinationHousehold.id, sourceHousehold.id] },
      },
    });
    await testDb.household.deleteMany({
      where: { id: { in: [destinationHousehold.id, sourceHousehold.id] } },
    });
    await testDb.user.deleteMany({ where: { id: userId } });
  }
});

void test("an unavailable source rolls back first-time User and Household bootstrap", async () => {
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceHousehold = await testDb.household.create({
    data: {
      name: `Unavailable Source Household ${uniqueId}`,
      slug: `save-intent-unavailable-source-${uniqueId}`,
    },
  });
  const stoppedSlug = `save-intent-stopped-${uniqueId}`;
  const deletedSlug = `save-intent-deleted-${uniqueId}`;
  const stoppedSource = await testDb.dinner.create({
    data: {
      name: `Stopped source ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: stoppedSlug,
      publishedAt: null,
    },
  });
  const deletedSource = await testDb.dinner.create({
    data: {
      name: `Deleted source ${uniqueId}`,
      householdId: sourceHousehold.id,
      publicSlug: deletedSlug,
      publishedAt: new Date(),
    },
  });
  await testDb.dinner.delete({ where: { id: deletedSource.id } });

  try {
    for (const [userId, publicSlug] of [
      [`save-intent-stopped-user-${uniqueId}`, stoppedSlug],
      [`save-intent-deleted-user-${uniqueId}`, deletedSlug],
    ] as const) {
      const result = await savePublishedDinnerForUser(
        testDb,
        { id: userId, firstName: null, lastName: null, imageUrl: null },
        publicSlug,
      );
      assert.equal(result, null);
      assert.equal(
        await testDb.user.findUnique({ where: { id: userId } }),
        null,
      );
      assert.equal(
        await testDb.membership.findUnique({ where: { userId } }),
        null,
      );
    }
  } finally {
    await testDb.dinner.deleteMany({ where: { id: stoppedSource.id } });
    await testDb.household.deleteMany({ where: { id: sourceHousehold.id } });
  }
});

void test.after(async () => testDb.$disconnect());
