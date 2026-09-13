import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { createPrismaClient } from "@planeatrepeat/db";

const { loadEnvConfig } = createRequire(import.meta.url)(
  "@next/env",
) as typeof import("@next/env");
loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for integration tests");

mock.module("@clerk/nextjs/server", {
  namedExports: {
    clerkClient: () => Promise.reject(new Error("Test users already exist")),
    getAuth: () => ({ userId: null }),
  },
});
const { shoppingListRouter } = await import("./api/routers/shoppingList");

const withShoppingList = async (
  run: (fixture: {
    caller: ReturnType<typeof shoppingListRouter.createCaller>;
    member: ReturnType<typeof shoppingListRouter.createCaller>;
  }) => Promise<void>,
) => {
  const db = createPrismaClient(databaseUrl);
  const marker = crypto.randomUUID();
  const userIds = [`shopping-admin-${marker}`, `shopping-member-${marker}`];
  await db.user.createMany({ data: userIds.map((id) => ({ id })) });
  const household = await db.household.create({
    data: {
      name: `Shopping ${marker}`,
      slug: `shopping-${marker}`,
      Members: {
        create: userIds.map((userId) => ({ userId, role: "MEMBER" })),
      },
    },
  });
  const callerFor = (userId: string) =>
    shoppingListRouter.createCaller({
      db,
      auth: { userId },
    } as Parameters<typeof shoppingListRouter.createCaller>[0]);
  try {
    await run({
      caller: callerFor(userIds[0]!),
      member: callerFor(userIds[1]!),
    });
  } finally {
    await db.household.delete({ where: { id: household.id } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
};

void test("Household members add literal Shopping Items, edit the shared list, and remove them", () =>
  withShoppingList(async ({ caller, member }) => {
    assert.deepEqual(await caller.list(), []);
    const potatoes = await caller.addManual({ name: "2 kg potatoes" });
    await member.addManual({ name: "Zucchini" });
    await caller.addManual({ name: "apples" });
    const items = await member.list();
    assert.deepEqual(
      items.map(({ name, amount, unit, note }) => ({
        name,
        amount,
        unit,
        note,
      })),
      [
        { name: "2 kg potatoes", amount: null, unit: null, note: null },
        { name: "apples", amount: null, unit: null, note: null },
        { name: "Zucchini", amount: null, unit: null, note: null },
      ],
    );
    await member.edit({
      id: potatoes.id,
      name: " Yukon potatoes ",
      amount: 1.5,
      unit: " kilograms ",
      note: " For roasting ",
    });
    const edited = await caller.list();
    assert.deepEqual(
      edited.map(({ name }) => name),
      ["apples", "Yukon potatoes", "Zucchini"],
    );
    assert.deepEqual(
      edited
        .filter(({ id }) => id === potatoes.id)
        .map(({ name, amount, unit, note }) => ({ name, amount, unit, note })),
      [
        {
          name: "Yukon potatoes",
          amount: 1.5,
          unit: "kg",
          note: "For roasting",
        },
      ],
    );
    await member.remove({ id: potatoes.id });
    assert.deepEqual(
      (await caller.list()).map(({ name }) => name),
      ["apples", "Zucchini"],
    );
  }));

void test("another Household cannot read, remove, or clear shared Shopping Items", () =>
  withShoppingList(async ({ caller }) => {
    const item = await caller.addManual({ name: "Private apples" });
    await withShoppingList(async ({ caller: other }) => {
      assert.deepEqual(await other.list(), []);
      await other.remove({ id: item.id });
      await other.addManual({ name: "Other apples" });
      await other.clear();
      assert.deepEqual(await other.list(), []);
      assert.equal((await caller.list())[0]?.id, item.id);
    });
    await caller.clear();
    assert.deepEqual(await caller.list(), []);
  }));

void test("manual additions combine bare names using only case and surrounding whitespace", () =>
  withShoppingList(async ({ caller, member }) => {
    const original = await caller.addManual({ name: "Green apples" });
    const duplicate = await member.addManual({ name: "  GREEN APPLES  " });
    assert.equal(duplicate.id, original.id);
    for (const name of ["Green  apples", "Green apple", "Gréen apples"]) {
      await caller.addManual({ name });
    }
    const items = await member.list();
    assert.equal(items.length, 4);
    assert.deepEqual(
      items.find(({ id }) => id === original.id),
      original,
    );
    assert.ok(items.every(({ amount, unit }) => amount === null && unit === null));
  }));
