import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { createPrismaClient, type Prisma } from "@planeatrepeat/db";

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
const { dinnerRouter } = await import("./api/routers/dinner");

const withShoppingList = async (
  run: (fixture: {
    caller: ReturnType<typeof shoppingListRouter.createCaller>;
    member: ReturnType<typeof shoppingListRouter.createCaller>;
    dinners: ReturnType<typeof dinnerRouter.createCaller>;
    createDinner: (
      data: Omit<Prisma.DinnerUncheckedCreateInput, "householdId">,
    ) => Promise<{ id: number }>;
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
      dinners: dinnerRouter.createCaller({
        db,
        auth: { userId: userIds[0]! },
      } as Parameters<typeof dinnerRouter.createCaller>[0]),
      createDinner: (data) =>
        db.dinner.create({ data: { ...data, householdId: household.id } }),
    });
  } finally {
    await db.dinner.deleteMany({ where: { householdId: household.id } });
    await db.household.delete({ where: { id: household.id } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }
};

void test("Household members manage Usually Have, add Dinner and manual items, edit the shared list, and remove them", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    assert.deepEqual(await caller.list(), []);
    const dinner = await createDinner({
      name: "Roast vegetables",
      servings: 4,
      parts: {
        create: [
          {
            order: 0,
            ingredients: {
              create: {
                order: 0,
                name: "Carrots",
                amount: 500,
                unit: "g",
                note: "Chopped",
              },
            },
          },
          {
            order: 1,
            ingredients: {
              create: {
                order: 0,
                name: "Oil",
                amount: 2,
                unit: "tbsp",
                note: "For frying",
              },
            },
          },
        ],
      },
    });
    assert.deepEqual(await caller.usuallyHave(), []);
    const oil = await member.addManual({ name: "Oil" });
    await caller.setUsuallyHave({ name: "  OIL  ", excluded: true });
    await member.setUsuallyHave({ name: "oil", excluded: true });
    assert.equal((await member.usuallyHave()).length, 1);
    assert.deepEqual(await caller.list(), [oil]);
    await caller.remove({ id: oil.id });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(
      (await member.list()).map(({ name }) => name),
      ["Carrots"],
    );
    await member.addManual({ name: "Oil" });
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
        { name: "Carrots", amount: 500, unit: "g", note: null },
        { name: "Oil", amount: null, unit: null, note: null },
        { name: "Zucchini", amount: null, unit: null, note: null },
      ],
    );
    await member.edit({
      id: potatoes.id,
      name: " Yukon potatoes ",
      amount: 1.5,
      unit: " kilograms ",
      note: " For roasting ",
      usuallyHave: true,
    });
    const edited = await caller.list();
    assert.deepEqual(
      edited.map(({ name }) => name),
      ["apples", "Carrots", "Oil", "Yukon potatoes", "Zucchini"],
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
    assert.deepEqual(
      (await member.usuallyHave()).map(({ normalizedName }) => normalizedName),
      ["oil", "yukon potatoes"],
    );
    await member.remove({ id: potatoes.id });
    assert.deepEqual(
      (await caller.list()).map(({ name }) => name),
      ["apples", "Carrots", "Oil", "Zucchini"],
    );
    await caller.setUsuallyHave({ name: "Carrots", excluded: true });
    await caller.clear();
    assert.equal((await member.usuallyHave()).length, 3);
    const skipped = await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(await member.list(), []);
    assert.deepEqual(skipped.undo.items, []);
    await member.setUsuallyHave({ name: " Oil ", excluded: false });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(
      (await member.list()).map(({ name, amount, unit }) => ({
        name,
        amount,
        unit,
      })),
      [{ name: "Oil", amount: 2, unit: "tbsp" }],
    );
  }));

void test("another Household cannot read or change Shopping Items, add private Dinners, or undo an addition", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    const dinner = await createDinner({ name: "Private apples" });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const item = (await caller.list())[0]!;
    await caller.setUsuallyHave({ name: "Private apples", excluded: true });
    await withShoppingList(
      async ({ caller: other, createDinner: createOtherDinner }) => {
        assert.deepEqual(await other.usuallyHave(), []);
        await other.setUsuallyHave({ name: "Private apples", excluded: false });
        assert.equal((await caller.usuallyHave()).length, 1);
        const otherDinner = await createOtherDinner({ name: "Other pears" });
        await assert.rejects(
          other.addDinners({ dinnerIds: [otherDinner.id, dinner.id] }),
        );
        assert.deepEqual(await other.list(), []);
        await other.undo(addition.undo);
        await other.remove({ id: item.id });
        await assert.rejects(
          other.edit({
            id: item.id,
            name: "Other apples",
            amount: null,
            unit: null,
            note: null,
          }),
        );
        await other.addManual({ name: "Other apples" });
        await other.clear();
        assert.deepEqual(await other.list(), []);
        assert.equal((await caller.list())[0]?.id, item.id);
      },
    );
    await caller.clear();
    assert.deepEqual(await caller.list(), []);
  }));

void test("incompatible and unspecified quantities stay adjacent and independently removable", () =>
  withShoppingList(async ({ caller }) => {
    await caller.addManual({ name: "Apples" });
    await caller.addManual({ name: "Zucchini" });
    for (const [amount, unit] of [
      [2, null],
      [400, "g"],
      [2, "pcs"],
      [null, "g"],
      [null, "grams"],
      [null, "kg"],
      [1, "handfuls"],
      [2, " handfuls "],
      [1, "Handfuls"],
    ] as const) {
      const draft = await caller.addManual({ name: "Next requirement" });
      await caller.edit({
        id: draft.id,
        name: "Tomatoes",
        amount,
        unit,
        note: null,
      });
    }
    const items = await caller.list();
    assert.deepEqual(
      items.map(({ name }) => name),
      ["Apples", ...Array<string>(7).fill("Tomatoes"), "Zucchini"],
    );
    const tomatoes = items.filter(({ name }) => name === "Tomatoes");
    assert.deepEqual(
      tomatoes.map(({ amount, unit }) => ({ amount, unit })),
      [
        { amount: 2, unit: null },
        { amount: 400, unit: "g" },
        { amount: 2, unit: "pcs" },
        { amount: null, unit: "g" },
        { amount: null, unit: "kg" },
        { amount: 3, unit: "handfuls" },
        { amount: 1, unit: "Handfuls" },
      ],
    );
    await caller.remove({ id: tomatoes[0]!.id });
    assert.deepEqual(
      await caller.list(),
      items.filter(({ id }) => id !== tomatoes[0]!.id),
    );
  }));

void test("manual additions combine bare names using only case and surrounding whitespace", () =>
  withShoppingList(async ({ caller, member }) => {
    const [original, duplicate] = await Promise.all([
      caller.addManual({ name: "Green apples" }),
      member.addManual({ name: "  GREEN APPLES  " }),
    ]);
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
    assert.ok(
      items.every(({ amount, unit }) => amount === null && unit === null),
    );
  }));

void test("saving a compatible edit combines quantities in the destination unit and preserves distinct notes", () =>
  withShoppingList(async ({ caller, member }) => {
    const potatoes = await caller.addManual({ name: "Potatoes" });
    await caller.edit({
      id: potatoes.id,
      name: "Potatoes",
      amount: 500,
      unit: "g",
      note: "For roasting",
    });
    const extra = await member.addManual({ name: "More potatoes" });
    const merged = await member.edit({
      id: extra.id,
      name: " POTATOES ",
      amount: 1,
      unit: "kilograms",
      note: "Organic; For roasting",
    });
    assert.equal(merged.id, potatoes.id);
    assert.deepEqual(
      (await caller.list()).map(({ name, amount, unit, note }) => ({
        name,
        amount,
        unit,
        note,
      })),
      [
        {
          name: "Potatoes",
          amount: 1500,
          unit: "g",
          note: "For roasting; Organic",
        },
      ],
    );
    // A bare manual addition remains unspecified alongside the numeric row.
    const bare = await caller.addManual({ name: "potatoes" });
    assert.notEqual(bare.id, potatoes.id);
    assert.equal(bare.amount, null);
    const final = await caller.edit({
      id: bare.id,
      name: "Potatoes",
      amount: 250,
      unit: "grams",
      note: "Organic",
    });
    assert.equal(final.amount, 1750);
    assert.equal(final.note, "For roasting; Organic");
    assert.equal((await member.list()).length, 1);
  }));

void test("Undo reverses a repeated Dinner batch while retaining pre-existing numeric and unquantified requirements", () =>
  withShoppingList(async ({ caller, member, createDinner, dinners }) => {
    const flour = await caller.addManual({ name: "Flour" });
    await caller.edit({
      id: flour.id,
      name: "Flour",
      amount: 500,
      unit: "g",
      note: "Bread flour",
    });
    await member.addManual({ name: "Salt" });
    const before = await caller.list();
    const dinner = await createDinner({
      name: "Bread",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              {
                order: 0,
                name: " FLOUR ",
                amount: 1,
                unit: "kg",
                note: "Sifted",
              },
              { order: 1, name: "salt" },
              { order: 2, name: "Yeast", amount: 7, unit: "g" },
              { order: 3, name: "Water" },
            ],
          },
        },
      },
    });
    const addition = await caller.addDinners({
      dinnerIds: [dinner.id, dinner.id],
    });
    assert.deepEqual(
      (await member.list()).map(({ name, amount, unit, note }) => ({
        name,
        amount,
        unit,
        note,
      })),
      [
        { name: "Flour", amount: 2500, unit: "g", note: "Bread flour" },
        { name: "Salt", amount: null, unit: null, note: null },
        { name: "Water", amount: null, unit: null, note: null },
        { name: "Yeast", amount: 14, unit: "g", note: null },
      ],
    );
    // Shopping requirements and Undo survive deletion of the source Recipe.
    await dinners.delete({ dinnerId: dinner.id });
    assert.equal((await member.list()).length, 4);
    await member.undo(addition.undo);
    assert.deepEqual(await caller.list(), before);
    await member.undo(addition.undo);
    assert.deepEqual(await caller.list(), before);
  }));

void test("ingredientless Dinners use their names, and Undo leaves intervening edits and removals alone", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    const dinners = await Promise.all([
      createDinner({ name: "Takeaway" }),
      createDinner({ name: "Toast", notes: "Use yesterday's bread" }),
      createDinner({
        name: "Soup",
        parts: {
          create: {
            order: 0,
            steps: { create: { order: 0, text: "Heat the soup" } },
          },
        },
      }),
    ]);
    const dinnerIds = dinners.map(({ id }) => id);
    const addition = await caller.addDinners({ dinnerIds });
    const repeated = await member.addDinners({ dinnerIds });
    await member.undo(repeated.undo);
    const items = await caller.list();
    assert.deepEqual(
      items.map(({ name, amount, unit, note }) => ({
        name,
        amount,
        unit,
        note,
      })),
      [
        { name: "Soup", amount: null, unit: null, note: null },
        { name: "Takeaway", amount: null, unit: null, note: null },
        { name: "Toast", amount: null, unit: null, note: null },
      ],
    );
    const takeaway = items.find(({ name }) => name === "Takeaway")!;
    await member.edit({ ...takeaway, name: "Pizza", note: "From the bakery" });
    await member.remove({ id: items.find(({ name }) => name === "Toast")!.id });
    await caller.undo(addition.undo);
    assert.deepEqual(
      (await member.list()).map(({ name }) => name),
      ["Pizza"],
    );
  }));
