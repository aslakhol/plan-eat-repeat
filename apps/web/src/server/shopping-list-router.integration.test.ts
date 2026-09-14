import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
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

void test("Shopping Products survive clearing, dismissal, and Usually Have removal across shopping trips", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    await caller.setUsuallyHave({ name: " Olive  oil ", excluded: true });
    const [preference] = await member.usuallyHave();
    assert.ok(preference?.productId);
    assert.deepEqual(await caller.list(), []);
    assert.deepEqual(await caller.recent(), []);

    const dinner = await createDinner({ name: "OLIVE\tOIL" });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const [recent] = await member.recent();
    assert.equal(recent?.productId, preference.productId);
    await member.undo(addition.undo);
    assert.deepEqual(await caller.recent(), []);
    await member.setUsuallyHave({ name: "olive oil", excluded: false });
    assert.deepEqual(await caller.usuallyHave(), []);

    const manual = await caller.addManual({ name: "olive oil" });
    assert.equal(manual.productId, preference.productId);
    const measured = await member.edit({
      ...manual,
      amount: 1,
      unit: "l",
      note: "For salad",
    });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    const active = await member.list();
    assert.equal(active.length, 2);
    assert.ok(active.every((item) => item.productId === preference.productId));
    assert.ok(
      active.some(
        (item) => item.id === measured.id && item.note === "For salad",
      ),
    );
    await caller.clear();
    const [cleared] = await member.recent();
    assert.equal(cleared?.productId, preference.productId);
    const restored = await member.addRecent({ id: cleared.id });
    assert.equal(restored.productId, preference.productId);
    await member.remove({ id: restored.id });
    const [removed] = await caller.recent();
    await caller.removeRecent({ id: removed!.id });
    assert.deepEqual(await caller.recent(), []);
    const nextTrip = await member.addManual({ name: "OLIVE   OIL" });
    assert.equal(nextTrip.productId, preference.productId);

    await withShoppingList(async ({ caller: other }) => {
      const otherOil = await other.addManual({ name: "Olive oil" });
      assert.notEqual(otherOil.productId, preference.productId);
    });
  }));

void test("Recently Used keeps the latest details per name, hides active names, and restores items for the Household", () =>
  withShoppingList(async ({ caller, member }) => {
    assert.deepEqual(await caller.recent(), []);
    const milk = await caller.addManual({ name: "Milk" });
    await caller.edit({ ...milk, amount: 1, unit: "l", note: "Whole milk" });
    const extra = await member.addManual({ name: " MILK " });
    await caller.remove({ id: milk.id });
    assert.deepEqual(await member.recent(), []);
    await member.edit({
      ...extra,
      amount: 200,
      unit: "ml",
      note: "For coffee",
    });
    await member.remove({ id: extra.id });
    const recent = await caller.recent();
    assert.equal(recent.length, 1);
    assert.deepEqual(
      recent.map(({ amount, unit, note }) => ({ amount, unit, note })),
      [{ amount: 200, unit: "ml", note: "For coffee" }],
    );
    await member.addRecent({ id: recent[0]!.id });
    await caller.addRecent({ id: recent[0]!.id });
    assert.deepEqual(await member.recent(), []);
    assert.deepEqual(
      (await caller.list()).map(({ amount, unit, note }) => ({
        amount,
        unit,
        note,
      })),
      [{ amount: 200, unit: "ml", note: "For coffee" }],
    );
  }));

void test("clearing the Shopping List remembers at most 25 displayed names and adding one leaves 24", () =>
  withShoppingList(async ({ caller }) => {
    for (let index = 0; index < 27; index++) {
      await caller.addManual({
        name: `Item ${String(index).padStart(2, "0")}`,
      });
    }
    await caller.clear();
    const recent = await caller.recent();
    assert.equal(recent.length, 25);
    assert.equal(recent[0]!.name, "Item 00");
    assert.equal(recent.at(-1)!.name, "Item 24");
    await caller.addManual({ name: " ITEM 00 " });
    assert.equal((await caller.recent()).length, 24);
    const [active] = await caller.list();
    await caller.remove({ id: active!.id });
    assert.equal((await caller.recent())[0]!.name.toLowerCase(), "item 00");
  }));

void test("editing, merging, and dismissing recent entries preserves recency and Usually Have preferences", () =>
  withShoppingList(async ({ caller, member }) => {
    for (const name of ["Milk", "Bread", "Apples"]) {
      const item = await caller.addManual({ name });
      await caller.remove({ id: item.id });
    }
    const before = await caller.recent();
    const milk = before.find((item) => item.name === "Milk")!;
    const bread = before.find((item) => item.name === "Bread")!;
    await member.editRecent({
      ...milk,
      name: "BREAD",
      amount: 2,
      unit: "pcs",
      note: "Wholemeal",
      usuallyHave: true,
    });
    const recent = await caller.recent();
    assert.deepEqual(
      recent.map((item) => item.name),
      ["Apples", "BREAD"],
    );
    assert.equal(
      recent[1]!.recentlyUsedAt.getTime(),
      bread.recentlyUsedAt.getTime(),
    );
    assert.equal(recent[1]!.amount, 2);
    assert.equal(recent[1]!.note, "Wholemeal");
    assert.deepEqual(await caller.list(), []);
    assert.deepEqual(
      (await member.usuallyHave()).map((item) => item.normalizedName),
      ["bread"],
    );
    await member.removeRecent({ id: recent[1]!.id });
    assert.deepEqual(
      (await caller.recent()).map((item) => item.name),
      ["Apples"],
    );
  }));

void test("excluded Dinner ingredients replace recent details and Undo restores the previous history", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    const milk = await caller.addManual({ name: "Milk" });
    await caller.edit({ ...milk, amount: 1, unit: "l", note: "Whole milk" });
    await caller.remove({ id: milk.id });
    const bread = await caller.addManual({ name: "Bread" });
    await caller.remove({ id: bread.id });
    await caller.setUsuallyHave({ name: "Milk", excluded: true });
    await caller.setUsuallyHave({ name: "Salt", excluded: true });
    const before = await caller.recent();
    const dinner = await createDinner({
      name: "Pancakes",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              { order: 2, name: "Milk", amount: 200, unit: "ml", note: "Warm" },
              { order: 0, name: " MILK ", amount: 100, unit: "ml" },
              { order: 1, name: "Salt", amount: 1, unit: "tsp" },
              { order: 3, name: "Flour", amount: 250, unit: "g" },
            ],
          },
        },
      },
    });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(
      (await member.recent()).map(({ name, amount, unit, note }) => ({
        name,
        amount,
        unit,
        note,
      })),
      [
        { name: "Milk", amount: 200, unit: "ml", note: null },
        { name: "Salt", amount: 1, unit: "tsp", note: null },
        { name: "Bread", amount: null, unit: null, note: null },
      ],
    );
    assert.deepEqual(
      (await caller.list()).map((item) => item.name),
      ["Flour"],
    );
    await member.undo(addition.undo);
    assert.deepEqual(await caller.recent(), before);
    assert.deepEqual(await caller.list(), []);
    await caller.undo(addition.undo);
    assert.deepEqual(await caller.recent(), before);
  }));

void test("Undo leaves recent entries edited, dismissed, restored, or removed again by another member alone", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    const names = ["Milk", "Salt", "Bread", "Apples"];
    for (const name of names)
      await caller.setUsuallyHave({ name, excluded: true });
    const dinner = await createDinner({
      name: "Breakfast",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: names.map((name, order) => ({
              name,
              order,
              amount: 1,
              unit: "pcs",
            })),
          },
        },
      },
    });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const recent = await member.recent();
    const named = (name: string) => recent.find((item) => item.name === name)!;
    await member.editRecent({ ...named("Milk"), amount: 2 });
    await member.removeRecent({ id: named("Salt").id });
    await member.addRecent({ id: named("Bread").id });
    const apples = await member.addRecent({ id: named("Apples").id });
    await member.remove({ id: apples.id });
    const beforeUndo = await member.recent();
    await caller.undo(addition.undo);
    assert.deepEqual(await member.recent(), beforeUndo);
    const bread = (await member.list())[0]!;
    assert.equal(bread.name, "Bread");
    // Restoring also protects the hidden recent entry from the earlier Undo.
    await member.edit({ ...bread, name: "Toast" });
    assert.ok((await member.recent()).some((item) => item.name === "Bread"));
  }));

void test("recent entry operations and Dinner Undo stay within their Household", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    await caller.setUsuallyHave({ name: "Milk", excluded: true });
    const dinner = await createDinner({ name: "Milk" });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const [recent] = await caller.recent();
    await withShoppingList(async ({ caller: other }) => {
      assert.deepEqual(await other.recent(), []);
      await assert.rejects(other.addRecent({ id: recent!.id }));
      await assert.rejects(
        other.editRecent({ ...recent!, name: "Stolen milk" }),
      );
      await other.removeRecent({ id: recent!.id });
      await other.undo(addition.undo);
      assert.deepEqual(await other.recent(), []);
    });
    assert.deepEqual(await caller.recent(), [recent]);
  }));

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
                name: "carrots",
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
        { name: "Apples", amount: null, unit: null, note: null },
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
      ["Apples", "Carrots", "Oil", "Yukon potatoes", "Zucchini"],
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
      ["Apples", "Carrots", "Oil", "Zucchini"],
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

void test("manual additions combine names regardless of capitalization and extra whitespace", () =>
  withShoppingList(async ({ caller, member }) => {
    const [original, duplicate] = await Promise.all([
      caller.addManual({ name: "Green apples" }),
      member.addManual({ name: "  GREEN APPLES  " }),
    ]);
    assert.equal(duplicate.id, original.id);
    const spaced = await caller.addManual({ name: " Green \t apples " });
    assert.equal(spaced.id, original.id);
    for (const name of ["Green apple", "Gréen apples"]) {
      await caller.addManual({ name });
    }
    const items = await member.list();
    assert.equal(items.length, 3);
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

void test("existing shopping details and reusable state survive the Shopping Product migration", async () => {
  // A disposable database exercises the actual historical migrations without
  // changing the development Household or depending on today's Prisma schema.
  const migrationRoot = new URL(
    "../../../../packages/db/prisma/migrations/",
    import.meta.url,
  );
  const migrations = readdirSync(migrationRoot)
    .filter((name) => name !== "migration_lock.toml")
    .sort();
  const firstProductMigration = migrations.indexOf(
    "20260915100000_normalize_shopping_names",
  );
  assert.ok(firstProductMigration > 0);
  const migrationSql = (names: string[]) =>
    names
      .map((name) =>
        readFileSync(new URL(`${name}/migration.sql`, migrationRoot), "utf8"),
      )
      .join("\n");
  const admin = createPrismaClient(databaseUrl);
  const databaseName = `shopping_migration_${crypto.randomUUID().replaceAll("-", "")}`;
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  const db = createPrismaClient(url.toString());
  const execute = (sql: string) => {
    const result = spawnSync(
      "pnpm",
      [
        "--filter",
        "@planeatrepeat/db",
        "exec",
        "prisma",
        "db",
        "execute",
        "--stdin",
      ],
      {
        cwd: new URL("../../../..", import.meta.url),
        env: { ...process.env, DATABASE_URL: url.toString() },
        input: sql,
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
  };
  await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
  try {
    execute(migrationSql(migrations.slice(0, firstProductMigration)));
    execute(`
      INSERT INTO "User" (id, "updatedAt") VALUES ('migration-user', now());
      INSERT INTO "Household" (id, name, slug, "updatedAt", "aiImportSpendAttributionKey")
      VALUES ('migration-household', 'Migration', 'migration-household', now(), 'migration-spend');
      INSERT INTO "Membership" ("householdId", "userId", role, "updatedAt", "aiImportSpendAttributionKey")
      VALUES ('migration-household', 'migration-user', 'MEMBER', now(), 'migration-member-spend');
      INSERT INTO "ShoppingItem" (id, "householdId", name, "normalizedName", amount, unit, note)
      VALUES ('measured', 'migration-household', 'Olive  oil', 'olive  oil', 500, 'ml', 'For salad'),
             ('bare', 'migration-household', 'OLIVE OIL', 'olive oil', NULL, NULL, 'Organic');
      INSERT INTO "RecentShoppingItem" (id, "householdId", name, "normalizedName", amount, unit, note, "recentlyUsedAt", revision)
      VALUES ('older', 'migration-household', 'Brown  rice', 'brown  rice', 1, 'kg', 'Old note', '2026-01-01', 'old-revision'),
             ('latest', 'migration-household', 'Brown rice', 'brown rice', 2, 'kg', 'For curry', '2026-02-01', 'latest-revision');
      INSERT INTO "UsuallyHave" ("householdId", name, "normalizedName")
      VALUES ('migration-household', 'Olive oil', 'olive oil'),
             ('migration-household', 'Olive  oil', 'olive  oil'),
             ('migration-household', 'Salt', 'salt');
    `);
    execute(migrationSql(migrations.slice(firstProductMigration)));
    const caller = shoppingListRouter.createCaller({
      db,
      auth: { userId: "migration-user" },
    } as Parameters<typeof shoppingListRouter.createCaller>[0]);
    const items = await caller.list();
    assert.deepEqual(
      items.map(({ id, name, amount, unit, note }) => ({
        id,
        name,
        amount,
        unit,
        note,
      })),
      [
        {
          id: "bare",
          name: "OLIVE OIL",
          amount: null,
          unit: null,
          note: "Organic",
        },
        {
          id: "measured",
          name: "Olive  oil",
          amount: 500,
          unit: "ml",
          note: "For salad",
        },
      ],
    );
    const [oil, salt] = await caller.usuallyHave();
    assert.equal(oil?.normalizedName, "olive oil");
    assert.equal(salt?.normalizedName, "salt");
    assert.ok(oil?.productId);
    assert.ok(items.every((item) => item.productId === oil.productId));
    const recent = await caller.recent();
    assert.equal(recent.length, 1);
    assert.deepEqual(
      recent.map(({ id, amount, unit, note, recentlyUsedAt, revision }) => ({
        id,
        amount,
        unit,
        note,
        recentlyUsedAt,
        revision,
      })),
      [
        {
          id: "latest",
          amount: 2,
          unit: "kg",
          note: "For curry",
          recentlyUsedAt: new Date("2026-02-01"),
          revision: "latest-revision",
        },
      ],
    );
    const restored = await caller.addRecent({ id: "latest" });
    assert.equal(restored.productId, recent[0]!.productId);
    await caller.clear();
    for (const item of await caller.recent())
      await caller.removeRecent({ id: item.id });
    await caller.setUsuallyHave({ name: "Olive oil", excluded: false });
    assert.equal(
      (await caller.addManual({ name: "Olive oil" })).productId,
      oil.productId,
    );
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
  }
});
