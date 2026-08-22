import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { createPrismaClient, type PrismaClient } from "@planeatrepeat/db";

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

const { dinnerRouter } = await import("./api/routers/dinner");
type DinnerCaller = ReturnType<typeof dinnerRouter.createCaller>;

const withDinnerCaller = async (
  run: (fixture: {
    caller: DinnerCaller;
    db: PrismaClient;
    householdId: string;
    marker: string;
  }) => Promise<void>,
) => {
  const db = createPrismaClient(databaseUrl);
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const userId = `dinner-link-${marker}`;
  await db.user.create({ data: { id: userId } });
  const household = await db.household.create({
    data: {
      name: `Dinner Link ${marker}`,
      slug: `dinner-link-${marker}`,
      Members: { create: { userId, role: "ADMIN" } },
    },
  });
  const caller = dinnerRouter.createCaller({
    db,
    auth: { userId },
  } as Parameters<typeof dinnerRouter.createCaller>[0]);

  try {
    await run({ caller, db, householdId: household.id, marker });
  } finally {
    await db.dinner.deleteMany({ where: { householdId: household.id } });
    await db.household.delete({ where: { id: household.id } });
    await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
};

void test("Dinner creation persists a normalized explicit Link", () =>
  withDinnerCaller(async ({ caller, marker }) => {
    const result = await caller.create({
      dinnerName: `Dinner ${marker}`,
      tagList: [],
      link: " https://EXAMPLE.com:443 ",
    });

    assert.equal(result.dinner.link, "https://example.com/");
  }));

void test("Dinner editing persists a normalized explicit Link", () =>
  withDinnerCaller(async ({ caller, db, householdId, marker }) => {
    const dinner = await db.dinner.create({
      data: { name: `Dinner ${marker}`, householdId },
    });

    const result = await caller.edit({
      dinnerId: dinner.id,
      dinnerName: dinner.name,
      tagList: [],
      link: " http://EXAMPLE.com:80 ",
    });

    assert.equal(result.dinner.link, "http://example.com/");
  }));

void test("Dinner creation rejects a scheme-less Link", () =>
  withDinnerCaller(async ({ caller, marker }) => {
    await assert.rejects(
      caller.create({
        dinnerName: `Dinner ${marker}`,
        tagList: [],
        link: "example.com/recipe",
      }),
      /Enter a valid link/,
    );
  }));

void test("Dinner editing rejects a scheme-less Link", () =>
  withDinnerCaller(async ({ caller, db, householdId, marker }) => {
    const dinner = await db.dinner.create({
      data: { name: `Dinner ${marker}`, householdId },
    });

    await assert.rejects(
      caller.edit({
        dinnerId: dinner.id,
        dinnerName: dinner.name,
        tagList: [],
        link: "example.com/recipe",
      }),
      /Enter a valid link/,
    );
  }));
