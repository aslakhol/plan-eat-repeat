import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { createPrismaClient } from "@planeatrepeat/db";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for integration tests");
}

mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () =>
      Promise.reject(
        new Error("The test user should already exist in the database"),
      ),
    getAuth: () => ({ userId: null }),
  },
});

const { planRouter } = await import("./api/routers/plan");

void test("Week overview lists this Household's week by Dinner name only", async () => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `plan-week-${marker}`;
  await db.user.create({ data: { id: userId } });
  const [household, otherHousehold] = await Promise.all(
    ["own", "other"].map((name) =>
      db.household.create({
        data: { name: `${name} ${marker}`, slug: `${name}-${marker}` },
      }),
    ),
  );
  assert(household && otherHousehold);
  await db.membership.create({
    data: { userId, householdId: household.id, role: "ADMIN" },
  });
  const caller = planRouter.createCaller({
    db,
    auth: {
      userId,
      sessionClaims: { metadata: { householdId: household.id } },
    },
  } as Parameters<typeof planRouter.createCaller>[0]);
  const startOfWeek = new Date("2026-09-28T00:00:00Z");

  try {
    const planned = await db.dinner.create({
      data: {
        name: "Tacos",
        notes: "Warm the tortillas.",
        householdId: household.id,
        Plan: {
          create: [
            { date: new Date("2026-09-30T00:00:00Z") },
            { date: new Date("2026-10-05T00:00:00Z") },
          ],
        },
      },
    });
    await db.dinner.create({
      data: {
        name: "Neighbour's soup",
        householdId: otherHousehold.id,
        Plan: { create: { date: new Date("2026-09-29T00:00:00Z") } },
      },
    });

    const { plans } = await caller.weekOverview({ startOfWeek });

    assert.deepEqual(
      plans.map(({ date, dinner }) => ({ date, dinner })),
      [
        {
          date: new Date("2026-09-30T00:00:00Z"),
          dinner: { id: planned.id, name: "Tacos" },
        },
      ],
    );
  } finally {
    await db.dinner.deleteMany({
      where: { householdId: { in: [household.id, otherHousehold.id] } },
    });
    await db.household.deleteMany({
      where: { id: { in: [household.id, otherHousehold.id] } },
    });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
});
