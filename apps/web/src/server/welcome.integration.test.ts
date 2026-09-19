import { createPrismaClient } from "@planeatrepeat/db";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");

mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () =>
      Promise.resolve({
        users: { updateUserMetadata: () => Promise.resolve({}) },
      }),
    getAuth: () => ({ userId: null }),
  },
});
const { householdRouter } = await import("./api/routers/household");
const { savePublishedDinnerForUser } = await import("./save-published-dinner");

const fixture = async () => {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const db = createPrismaClient(databaseUrl);
  const id = `welcome-${crypto.randomUUID()}`;
  const user = await db.user.create({
    data: { id, firstName: "New", lastName: "User" },
  });
  const caller = householdRouter.createCaller({
    db,
    auth: { userId: id, sessionClaims: { metadata: {} } },
  } as Parameters<typeof householdRouter.createCaller>[0]);
  return {
    db,
    user,
    caller,
    cleanup: async () => {
      const households = await db.household.findMany({
        where: { OR: [{ Members: { some: { userId: id } } }, { slug: id }] },
        select: { id: true },
      });
      const ids = households.map((household) => household.id);
      await db.dinner.deleteMany({ where: { householdId: { in: ids } } });
      await db.household.deleteMany({ where: { id: { in: ids } } });
      await db.user.delete({ where: { id } });
      await db.$disconnect();
    },
  };
};

void test("first visits create one empty household and remember dismissal for this user", async () => {
  const { db, user, caller, cleanup } = await fixture();
  try {
    assert.deepEqual(await caller.welcomeStatus({ userId: user.id }), {
      householdId: null,
      welcomeSeenAt: null,
    });
    const starts = await Promise.all([caller.start(), caller.start()]);
    assert.equal(starts[0].householdId, starts[1].householdId);
    assert.equal(
      await db.household.count({
        where: { Members: { some: { userId: user.id } } },
      }),
      1,
    );
    assert.equal(
      await db.dinner.count({
        where: { householdId: starts[0].householdId },
      }),
      0,
    );
    const dismissed = await caller.dismissWelcome();
    assert.ok(dismissed.welcomeSeenAt);
    assert.deepEqual(await caller.start(), dismissed);
    assert.deepEqual(
      await caller.welcomeStatus({ userId: user.id }),
      dismissed,
    );
    await assert.rejects(caller.welcomeStatus({ userId: "someone-else" }), {
      code: "FORBIDDEN",
    });
  } finally {
    await cleanup();
  }
});

void test("an invitee keeps the joined household and gets their own welcome", async () => {
  const { db, user, caller, cleanup } = await fixture();
  try {
    const household = await db.household.create({
      data: { name: "Shared home", slug: user.id },
    });
    const invite = await db.invite.create({
      data: {
        householdId: household.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await caller.welcomeStatus({ userId: user.id });
    assert.equal(await db.membership.count({ where: { userId: user.id } }), 0);
    await caller.join({ inviteId: invite.id });
    assert.deepEqual(await caller.start(), {
      householdId: household.id,
      welcomeSeenAt: null,
    });
    assert.equal(
      (await db.membership.findUniqueOrThrow({ where: { userId: user.id } }))
        .role,
      "MEMBER",
    );
  } finally {
    await cleanup();
  }
});

void test("a first visit racing a recipe save shares one household and preserves the recipe", async () => {
  const { db, user, caller, cleanup } = await fixture();
  try {
    const source = await db.household.create({
      data: { name: "Source", slug: user.id },
    });
    const dinner = await db.dinner.create({
      data: {
        householdId: source.id,
        name: "Soup",
        publicSlug: user.id,
        publishedAt: new Date(),
      },
    });
    const [started, saved] = await Promise.all([
      caller.start(),
      savePublishedDinnerForUser(db, user, user.id),
    ]);
    assert.equal(started.householdId, saved?.householdId);
    assert.equal(
      await db.dinner.count({
        where: { householdId: started.householdId, sourceDinnerId: dinner.id },
      }),
      1,
    );
    assert.equal(
      (await caller.welcomeStatus({ userId: user.id })).welcomeSeenAt,
      null,
    );
  } finally {
    await cleanup();
  }
});
