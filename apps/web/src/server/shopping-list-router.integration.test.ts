import { suggestShoppingItems } from "../lib/shopping-matching";
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
const { householdRouter } = await import("./api/routers/household");

const withShoppingList = async (
  run: (fixture: {
    caller: ReturnType<typeof shoppingListRouter.createCaller>;
    member: ReturnType<typeof shoppingListRouter.createCaller>;
    dinners: ReturnType<typeof dinnerRouter.createCaller>;
    settings: ReturnType<typeof householdRouter.createCaller>;
    memberSettings: ReturnType<typeof householdRouter.createCaller>;
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
  const settingsFor = (userId: string) =>
    householdRouter.createCaller({
      db,
      auth: {
        userId,
        sessionClaims: { metadata: { householdId: household.id } },
      },
    } as Parameters<typeof householdRouter.createCaller>[0]);
  try {
    await run({
      caller: callerFor(userIds[0]!),
      member: callerFor(userIds[1]!),
      settings: settingsFor(userIds[0]!),
      memberSettings: settingsFor(userIds[1]!),
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

void test("Dinner additions deduplicate concurrent retries while preserving repeated occurrences and original Undo", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    const dinner = await createDinner({
      name: "Bread",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              { order: 0, name: "Flour", amount: 250, unit: "g" },
              { order: 1, name: "Salt", amount: 1, unit: "g" },
            ],
          },
        },
      },
    });
    await caller.setUsuallyHave({ name: "Salt", excluded: true });
    const input = {
      operationId: crypto.randomUUID(),
      dinnerIds: [dinner.id, dinner.id],
    };
    const [first, concurrent] = await Promise.all([
      caller.addDinners(input),
      member.addDinners(input),
    ]);
    assert.deepEqual(concurrent.undo, first.undo);
    assert.equal((await caller.list())[0]?.amount, 500);
    assert.equal(first.items[0]?.amount, 500);
    assert.equal(first.recentItems[0]?.name, "Salt");
    const flour = (await caller.list())[0]!;
    await caller.edit({ ...flour, amount: 700 });
    // The first response was lost. Recovery returns its Undo and current rows.
    const recovered = await caller.addDinners(input);
    assert.deepEqual(recovered.undo, first.undo);
    assert.equal(recovered.items[0]?.amount, 700);
    await caller.undo(recovered.undo);
    assert.equal((await caller.list())[0]?.amount, 700);
    assert.deepEqual(await caller.recent(), []);
    await assert.rejects(
      caller.addDinners({ ...input, dinnerIds: [dinner.id] }),
      /different Dinner selections/,
    );
  }));

void test("Dinner batch selection order chooses the first unit and last Usually Have quantity across repeated Dinners", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    await caller.setUsuallyHave({ name: "Salt", excluded: true });
    const create = (name: string, amount: number, unit: string) =>
      createDinner({
        name,
        parts: {
          create: {
            order: 0,
            ingredients: {
              create: [
                { order: 0, name: "Flour", amount, unit },
                { order: 1, name: "Salt", amount, unit },
              ],
            },
          },
        },
      });
    const grams = await create("Grams", 250, "g");
    const kilos = await create("Kilos", 1, "kg");
    const addition = await caller.addDinners({
      dinnerIds: [kilos.id, grams.id, kilos.id],
    });
    assert.deepEqual(
      addition.items.map(({ name, amount, unit }) => ({ name, amount, unit })),
      [{ name: "Flour", amount: 2.25, unit: "kg" }],
    );
    assert.deepEqual(
      addition.recentItems.map(({ name, amount, unit }) => ({
        name,
        amount,
        unit,
      })),
      [{ name: "Salt", amount: 1, unit: "kg" }],
    );
    // A distinct concurrent action still adds once after taking the same lock.
    await Promise.all([
      caller.addDinners({ dinnerIds: [grams.id] }),
      member.addDinners({ dinnerIds: [grams.id] }),
    ]);
    await member.undo(addition.undo);
    assert.equal((await caller.list())[0]?.amount, 2.75);
    assert.equal((await caller.recent())[0]?.amount, 250);
  }));

void test("Dinner addition receipts are Household scoped and failed additions leave no committed work", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    const dinner = await createDinner({ name: "Household dinner" });
    const operationId = crypto.randomUUID();
    await withShoppingList(
      async ({ caller: other, createDinner: otherDinner }) => {
        const foreign = await otherDinner({ name: "Other dinner" });
        const input = { operationId, dinnerIds: [foreign.id, dinner.id] };
        await assert.rejects(other.addDinners(input));
        assert.deepEqual(await other.list(), []);
        const added = await caller.addDinners({
          operationId,
          dinnerIds: [dinner.id],
        });
        const otherAdded = await other.addDinners({
          operationId,
          dinnerIds: [foreign.id],
        });
        assert.equal(added.items[0]?.name, "Household dinner");
        assert.equal(otherAdded.items[0]?.name, "Other dinner");
      },
    );
  }));

void test("Own Items distinguish normalized notes and an edit collision keeps the edited settings and quantities", () =>
  withShoppingList(async ({ caller }) => {
    const duck = await caller.addManual({ name: "Eggs" });
    await caller.edit({
      ...duck,
      amount: 12,
      note: "duck",
      category: "DAIRY",
      usuallyHave: true,
    });
    const hen = await caller.addManual({ name: "Eggs" });
    const edited = await caller.edit({
      ...hen,
      amount: 6,
      note: "hen",
      category: "MEAT",
    });
    assert.equal((await caller.list()).length, 2);
    const merged = await caller.edit({
      ...edited,
      name: " EGGS ",
      note: " DUCK ",
    });
    assert.equal(merged.amount, 18);
    assert.equal(merged.ownItem.category, "MEAT");
    assert.equal((await caller.list()).length, 1);
    assert.deepEqual(await caller.usuallyHave(), []);
    await caller.clear();
    const [recent] = await caller.recent();
    assert.equal(recent?.amount, 18);
    assert.equal(recent?.note, "DUCK");
  }));

void test("Own Item edits update all referring quantities and deletion preserves other note variants", () =>
  withShoppingList(async ({ caller }) => {
    const plain = await caller.addManual({ name: "Eggs" });
    await caller.edit({
      ...plain,
      amount: 6,
      category: "MEAT",
      usuallyHave: true,
    });
    const unspecified = await caller.addManual({ name: "EGGS" });
    await caller.edit({ ...unspecified, note: "duck", name: "Duck eggs" });
    const edited = await caller.list();
    assert.deepEqual(
      edited.map(({ name, amount, note }) => ({ name, amount, note })),
      [
        { name: "Duck eggs", amount: 6, note: "duck" },
        { name: "Duck eggs", amount: null, note: "duck" },
      ],
    );
    await caller.remove({ id: plain.id });
    const source = edited[1]!;
    await caller.edit({ ...source, category: "SNACKS", amount: 2 });
    await caller.remove({ id: source.id });
    const [recent] = await caller.recent();
    assert.equal(recent?.amount, 2);
    assert.equal(recent?.ownItem.category, "SNACKS");
    assert.equal((await caller.usuallyHave())[0]?.note, "duck");
    const hen = await caller.addManual({ name: "Duck eggs" });
    await caller.edit({
      ...hen,
      note: "hen",
      usuallyHave: true,
      category: "DAIRY",
    });
    await withShoppingList(async ({ caller: other }) => {
      await assert.rejects(
        other.setUsuallyHave({ id: hen.ownItemId, excluded: false }),
      );
      await other.deleteOwnItem({ id: source.ownItemId });
      assert.equal((await caller.recent()).length, 1);
    });
    await caller.deleteOwnItem({ id: source.ownItemId });
    assert.deepEqual(await caller.recent(), []);
    assert.deepEqual(
      (await caller.usuallyHave()).map(({ note }) => note),
      ["hen"],
    );
    assert.deepEqual(
      (await caller.list()).map(({ note }) => note),
      ["hen"],
    );
    const forgotten = await caller.addManual({ name: "Duck eggs" });
    assert.equal(forgotten.ownItem.usuallyHave, false);
  }));

void test("Dinner ingredients resolve to remembered variants and a corrected exact name wins on re-import", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    const dinner = await createDinner({
      name: "Duck egg breakfast",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              {
                order: 0,
                name: "Duck eggs",
                amount: 6,
                note: "Unwrap before serving",
              },
              { order: 1, name: "Cheese bread", amount: 1 },
            ],
          },
        },
      },
    });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    const items = await caller.list();
    const eggs = items.find(({ name }) => name === "Eggs")!;
    assert.ok(eggs);
    assert.equal(eggs.note, "Duck");
    assert.equal(eggs.amount, 6);
    assert.equal(eggs.ownItem.category, "DAIRY");
    const ambiguous = items.find(({ name }) => name === "Cheese bread")!;
    assert.equal(ambiguous.note, null);
    const corrected = await caller.edit({
      ...eggs,
      name: "Duck eggs",
      note: null,
      category: "SNACKS",
    });
    await caller.clear();
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const imported = (await caller.list()).find(
      ({ name }) => name === "Duck eggs",
    )!;
    assert.equal(imported.ownItemId, corrected.ownItemId);
    assert.equal(imported.note, null);
    assert.equal(imported.ownItem.category, "SNACKS");
    assert.equal(imported.amount, 6);
    await caller.undo(addition.undo);
    assert.deepEqual(await caller.list(), []);
  }));

void test("Dinner resolution checks the destination variant's Usually Have and category, and Undo restores its recent quantity", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    const cheese = await caller.addManual({ name: "Cheese" });
    await caller.edit({ ...cheese, category: "MEAT", usuallyHave: true });
    await caller.remove({ id: cheese.id });
    const dinner = await createDinner({
      name: "Cheese snacks",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: {
              order: 0,
              name: "Cheese balls",
              amount: 2,
              unit: "handful",
              note: "Crumble finely",
            },
          },
        },
      },
    });
    const first = await caller.addDinners({ dinnerIds: [dinner.id] });
    const variant = (await caller.list())[0]!;
    assert.equal(variant.name, "Cheese");
    assert.equal(variant.note, "balls");
    assert.equal(variant.ownItem.category, "MEAT");
    assert.equal(variant.ownItem.usuallyHave, false);
    await member.edit({
      ...variant,
      amount: 7,
      category: "SNACKS",
      usuallyHave: true,
    });
    await caller.undo(first.undo);
    assert.equal((await caller.list())[0]?.amount, 7);
    await member.remove({ id: variant.id });
    const before = await caller.recent();
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(await caller.list(), []);
    const resolved = (await caller.recent()).find(
      ({ ownItemId }) => ownItemId === variant.ownItemId,
    )!;
    assert.equal(resolved.amount, 2);
    assert.equal(resolved.unit, "handful");
    assert.equal(resolved.note, "balls");
    assert.equal(resolved.ownItem.category, "SNACKS");
    await member.undo(addition.undo);
    assert.deepEqual(await caller.recent(), before);
    const later = await caller.addDinners({ dinnerIds: [dinner.id] });
    await member.removeRecent({ id: resolved.id });
    await caller.undo(later.undo);
    assert.ok(
      !(await caller.recent()).some(
        ({ ownItemId }) => ownItemId === variant.ownItemId,
      ),
    );
  }));

void test("recipe sources follow Shopping Language and keep saved names within their Household", () =>
  withShoppingList(async ({ caller, settings, createDinner }) => {
    await settings.updateHousehold({ shoppingLanguage: "no" });
    const oats = await caller.addManual({ name: "Oats" });
    await caller.edit({ ...oats, category: "SNACKS" });
    await caller.remove({ id: oats.id });
    const data = {
      name: "Breakfast",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              { order: 0, name: "Økologisk gulrot" },
              { order: 1, name: "Oats organic" },
              { order: 2, name: "Duck eggs" },
            ],
          },
        },
      },
    };
    const dinner = await createDinner(data);
    await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.deepEqual(
      (await caller.list()).map(({ name, note }) => [name, note]),
      [
        ["Gulrot", "Økologisk"],
        ["Oats", "organic"],
        ["Duck eggs", null],
      ],
    );
    await withShoppingList(
      async ({ caller: other, createDinner: createOtherDinner }) => {
        const otherDinner = await createOtherDinner(data);
        await other.addDinners({ dinnerIds: [otherDinner.id] });
        const otherItems = await other.list();
        assert.equal(
          otherItems.find(({ name }) => name === "Økologisk gulrot")?.note,
          null,
        );
        assert.equal(
          otherItems.find(({ name }) => name === "Oats organic")?.note,
          null,
        );
        assert.equal(
          otherItems.find(({ name }) => name === "Eggs")?.note,
          "Duck",
        );
      },
    );
  }));

void test("Dinner additions ignore saved notes absent from the ingredient name and Undo protects later definition edits", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    const eggs = await caller.addManual({ name: "Eggs" });
    await caller.edit({ ...eggs, note: "duck", usuallyHave: true, amount: 6 });
    const dinner = await createDinner({
      name: "Breakfast",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              { order: 0, name: "Eggs", amount: 12, note: "Beaten" },
              {
                order: 1,
                name: "Car",
                amount: 1,
                unit: "handful",
                note: "Chopped",
              },
            ],
          },
        },
      },
    });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const added = await caller.list();
    const plain = added.find(
      ({ name, note }) => name === "Eggs" && note === null,
    )!;
    assert.equal(plain.amount, 12);
    assert.equal(plain.ownItem.usuallyHave, false);
    assert.equal(added.find(({ name }) => name === "Car")?.unit, "handful");
    await caller.edit({ ...plain, category: "MEAT" });
    await caller.undo(addition.undo);
    assert.equal((await caller.list()).length, 2);
    assert.equal(
      (await caller.list()).find(
        ({ ownItemId }) => ownItemId === plain.ownItemId,
      )?.ownItem.category,
      "MEAT",
    );
    await caller.clear();
    for (const item of await caller.recent())
      await caller.removeRecent({ id: item.id });
    assert.equal(
      (await caller.addManual({ name: "Eggs" })).ownItemId,
      plain.ownItemId,
    );
  }));

void test("recent edits that collide keep the edited settings and combine every compatible active quantity", () =>
  withShoppingList(async ({ caller }) => {
    const duck = await caller.addManual({ name: "Eggs" });
    await caller.edit({
      ...duck,
      note: "duck",
      amount: 12,
      category: "DAIRY",
      usuallyHave: true,
    });
    await caller.remove({ id: duck.id });
    const [recentDuck] = await caller.recent();
    await caller.addRecent({ id: recentDuck!.id });
    const hen = await caller.addManual({ name: "Eggs" });
    await caller.edit({ ...hen, note: "hen", amount: 6, category: "MEAT" });
    await caller.remove({ id: hen.id });
    const [recentHen] = await caller.recent();
    await caller.addRecent({ id: recentHen!.id });
    const saved = await caller.editRecent({
      ...recentHen!,
      note: " DUCK ",
      amount: 3,
    });
    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0]?.amount, 18);
    assert.equal(saved.recentItems[0]?.amount, 3);
    assert.equal(saved.mergedIds[recentHen!.id], saved.id);
    const [active] = await caller.list();
    assert.equal(active?.amount, 18);
    assert.equal(active?.ownItem.category, "MEAT");
    assert.deepEqual(await caller.usuallyHave(), []);
    assert.deepEqual(await caller.recent(), []);
    await caller.clear();
    const [recent] = await caller.recent();
    assert.equal(recent?.amount, 18);
  }));

void test("an older source requirement converts into the destination unit when Own Items collide", () =>
  withShoppingList(async ({ caller }) => {
    const source = await caller.addManual({ name: "Spuds" });
    const measured = await caller.edit({ ...source, amount: 1, unit: "kg" });
    const destination = await caller.addManual({ name: "Potatoes" });
    await caller.edit({
      ...destination,
      amount: 500,
      unit: "g",
      note: "For roasting",
    });
    const merged = await caller.edit({
      ...measured,
      name: "Potatoes",
      note: "For roasting",
    });
    assert.equal(merged.id, destination.id);
    assert.equal(merged.amount, 1500);
    assert.equal(merged.unit, "g");
    assert.deepEqual(
      merged.affectedOwnItemIds.sort(),
      [source.ownItemId, destination.ownItemId].sort(),
    );
    assert.deepEqual(
      merged.items.map(({ id, amount }) => ({ id, amount })),
      [{ id: destination.id, amount: 1500 }],
    );
    assert.equal(merged.mergedIds[source.id], destination.id);
    assert.deepEqual(merged.recentItems, []);
  }));

void test("Shopping Language defaults to English and ordinary members update only their Household", () =>
  withShoppingList(async ({ settings, memberSettings }) => {
    assert.equal(
      (await settings.household()).household?.shoppingLanguage,
      "en",
    );
    await memberSettings.updateHousehold({ shoppingLanguage: "no" });
    assert.equal(
      (await settings.household()).household?.shoppingLanguage,
      "no",
    );
    await withShoppingList(async ({ settings: other }) => {
      assert.equal((await other.household()).household?.shoppingLanguage, "en");
    });
    await settings.updateHousehold({ shoppingLanguage: "en" });
    assert.equal(
      (await memberSettings.household()).household?.shoppingLanguage,
      "en",
    );
  }));

void test("only the selected standard catalog categorizes new names", () =>
  withShoppingList(async ({ caller, memberSettings }) => {
    await memberSettings.updateHousehold({ shoppingLanguage: "no" });
    for (const [name, category] of [
      ["Milk", "OWN_ITEMS"],
      ["Melk", "DAIRY"],
      ["Fersk  KJØTTDEIG", "MEAT"],
      ["Poteter", "OWN_ITEMS"],
      ["Potet", "PRODUCE"],
      ["Te", "BEVERAGES"],
    ] as const) {
      assert.equal(
        (await caller.addManual({ name })).ownItem.category,
        category,
      );
    }
    await memberSettings.updateHousehold({ shoppingLanguage: "en" });
    assert.equal(
      (await caller.addManual({ name: "Milk" })).ownItem.category,
      "OWN_ITEMS",
    );
    assert.equal(
      (await caller.addManual({ name: "Egg" })).ownItem.category,
      "OWN_ITEMS",
    );
    assert.equal(
      (await caller.addManual({ name: "Eggs" })).ownItem.category,
      "DAIRY",
    );
  }));

void test("language changes preserve entered names and remembered assignments without translating overrides", () =>
  withShoppingList(async ({ caller, settings, createDinner }) => {
    const milk = await caller.addManual({ name: "Milk" });
    const mystery = await caller.addManual({ name: "Melk" });
    const beef = await caller.addManual({ name: "Beef" });
    await caller.edit({ ...beef, category: "SNACKS" });
    await settings.updateHousehold({ shoppingLanguage: "no" });
    assert.deepEqual(
      (await caller.list()).map(({ name, ownItem }) => [
        name,
        ownItem.category,
      ]),
      [
        ["Milk", "DAIRY"],
        ["Beef", "SNACKS"],
        ["Melk", "OWN_ITEMS"],
      ],
    );
    assert.equal(
      (await caller.addManual({ name: "Fresh milk" })).ownItem.category,
      "DAIRY",
    );
    assert.equal(
      (await caller.addManual({ name: "Beef balls" })).ownItem.category,
      "SNACKS",
    );
    assert.equal(
      (await caller.addManual({ name: "Storfekjøtt" })).ownItem.category,
      "MEAT",
    );
    assert.equal(
      (await caller.addManual({ name: "Bread" })).ownItem.category,
      "OWN_ITEMS",
    );
    await caller.remove({ id: milk.id });
    await caller.remove({ id: mystery.id });
    for (const recent of await caller.recent())
      await caller.addRecent({ id: recent.id });
    assert.equal(
      (await caller.list()).find((item) => item.name === "Melk")?.ownItem
        .category,
      "OWN_ITEMS",
    );
    const dinner = await createDinner({
      name: "Breakfast",
      parts: {
        create: {
          order: 0,
          ingredients: { create: { order: 0, name: "Brød" } },
        },
      },
    });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    assert.equal(
      (await caller.list()).find((item) => item.name === "Brød")?.ownItem
        .category,
      "BAKERY",
    );
    await withShoppingList(async ({ caller: other }) => {
      assert.equal(
        (await other.addManual({ name: "Milk" })).ownItem.category,
        "DAIRY",
      );
      assert.equal(
        (await other.addManual({ name: "Melk" })).ownItem.category,
        "OWN_ITEMS",
      );
    });
  }));

void test("category labels follow Shopping Language while category identity and order stay stable", () =>
  withShoppingList(async ({ caller, member, memberSettings }) => {
    const english = await caller.categories();
    assert.deepEqual(english[0], {
      id: "PRODUCE",
      label: "Fruits & Vegetables",
    });
    assert.deepEqual(english.at(-1), { id: "OWN_ITEMS", label: "Own Items" });
    await memberSettings.updateHousehold({ shoppingLanguage: "no" });
    const norwegian = await member.categories();
    assert.deepEqual(
      norwegian.map(({ id }) => id),
      english.map(({ id }) => id),
    );
    assert.deepEqual(norwegian[0], { id: "PRODUCE", label: "Frukt og grønt" });
    assert.deepEqual(norwegian[2], { id: "DAIRY", label: "Meieriprodukter" });
    assert.deepEqual(norwegian.at(-1), {
      id: "OWN_ITEMS",
      label: "Egne varer",
    });
  }));

void test("first shopping names use exact catalog matches, longest whole phrases, and Own Items", () =>
  withShoppingList(async ({ caller }) => {
    for (const name of [
      "Coconut milk",
      "Chocolate milk",
      "Fresh  BEEF\tsteak",
      "Potato",
      "Oat drink",
      "Tea towels",
      "Milkshake",
      "(Milk)",
      "Beef milk",
      "Milk beef",
    ]) {
      await caller.addManual({ name });
    }
    assert.deepEqual(
      Object.fromEntries(
        (await caller.list()).map((item) => [
          item.normalizedName,
          item.ownItem.category,
        ]),
      ),
      {
        "coconut milk": "INGREDIENTS",
        "chocolate milk": "SNACKS",
        "fresh beef steak": "MEAT",
        potato: "OWN_ITEMS",
        "oat drink": "OWN_ITEMS",
        "tea towels": "BEVERAGES",
        milkshake: "OWN_ITEMS",
        "(milk)": "DAIRY",
        "beef milk": "MEAT",
        "milk beef": "DAIRY",
      },
    );
  }));

void test("Household category edits affect same-name requirements while inherited names keep their memory", () =>
  withShoppingList(async ({ caller, member }) => {
    const steak = await caller.addManual({ name: "Beef steak" });
    const beef = await caller.addManual({ name: "Beef" });
    await member.edit({ ...beef, amount: 1, unit: "kg" });
    await caller.addManual({ name: " BEEF " });
    await caller.remove({ id: steak.id });
    const [recentSteak] = await caller.recent();
    await caller.removeRecent({ id: recentSteak!.id });
    await member.edit({ ...beef, amount: 1, unit: "kg", category: "SNACKS" });
    assert.ok(
      (await caller.list()).every((item) => item.ownItem.category === "SNACKS"),
    );
    await caller.addManual({ name: "Beef steak" });
    const balls = await caller.addManual({ name: "Beef balls" });
    assert.equal(balls.ownItem.category, "SNACKS");
    await caller.edit({
      ...beef,
      amount: 1,
      unit: "kg",
      category: "HOUSEHOLD",
    });
    const freshBalls = await caller.addManual({ name: "Fresh beef balls" });
    assert.equal(freshBalls.ownItem.category, "SNACKS");
    const newBeef = await caller.addManual({ name: "New beef" });
    assert.equal(newBeef.ownItem.category, "HOUSEHOLD");
    assert.equal(
      (await caller.list()).find((item) => item.name === "Beef steak")!.ownItem
        .category,
      "MEAT",
    );
    await caller.clear();
    for (const item of await caller.recent())
      await caller.removeRecent({ id: item.id });
    assert.equal(
      (await member.addManual({ name: "Beef steak" })).ownItem.category,
      "MEAT",
    );
    assert.equal(
      (await member.addManual({ name: "Beef" })).ownItem.category,
      "HOUSEHOLD",
    );
    await withShoppingList(async ({ caller: other }) => {
      assert.equal(
        (await other.addManual({ name: "Beef" })).ownItem.category,
        "MEAT",
      );
      await assert.rejects(other.edit({ ...beef, category: "DAIRY" }));
    });
  }));

void test("Own Items blocks only its exact name and Usually Have remembers categories without a purchase", () =>
  withShoppingList(async ({ caller, member }) => {
    const party = await caller.addManual({ name: "Party supplies" });
    assert.equal(party.ownItem.category, "OWN_ITEMS");
    await caller.clear();
    const supplies = await caller.addManual({ name: "supplies" });
    await member.edit({ ...supplies, category: "HOUSEHOLD" });
    const [recent] = await caller.recent();
    await member.addRecent({ id: recent!.id });
    assert.equal(
      (await caller.list()).find(
        (item) => item.normalizedName === "party supplies",
      )!.ownItem.category,
      "OWN_ITEMS",
    );
    assert.equal(
      (await caller.addManual({ name: "Party supplies bucket" })).ownItem
        .category,
      "HOUSEHOLD",
    );
    const milk = await caller.addManual({ name: "Milk" });
    await caller.edit({ ...milk, category: "OWN_ITEMS" });
    assert.equal(
      (await caller.addManual({ name: "Fresh milk" })).ownItem.category,
      "OWN_ITEMS",
    );
    assert.equal(
      (await caller.addManual({ name: "Coconut milk" })).ownItem.category,
      "INGREDIENTS",
    );
    await caller.setUsuallyHave({ name: "Daily supplies", excluded: true });
    assert.ok(
      !(await caller.list()).some(
        (item) => item.normalizedName === "daily supplies",
      ),
    );
    assert.ok(
      !(await caller.recent()).some(
        (item) => item.normalizedName === "daily supplies",
      ),
    );
    await caller.edit({ ...supplies, category: "CARE" });
    await caller.setUsuallyHave({ name: "Daily supplies", excluded: false });
    assert.equal(
      (await member.addManual({ name: "Daily supplies" })).ownItem.category,
      "HOUSEHOLD",
    );
  }));

void test("active and recent renames keep the edited definition when identities collide", () =>
  withShoppingList(async ({ caller, member }) => {
    const milk = await caller.addManual({ name: "Milk" });
    const oat = await caller.addManual({ name: "Oat drink" });
    const renamed = await caller.edit({ ...oat, name: "Special beef" });
    assert.equal(renamed.ownItem.category, "OWN_ITEMS");
    const merged = await member.edit({ ...renamed, name: "Milk" });
    assert.equal(merged.id, milk.id);
    assert.equal(merged.ownItem.category, "OWN_ITEMS");
    const paper = await caller.addManual({ name: "Paper bundle" });
    const selected = await caller.edit({
      ...paper,
      name: "Milk",
      category: "HOUSEHOLD",
    });
    assert.equal(selected.ownItem.category, "HOUSEHOLD");
    await caller.clear();
    const [recentMilk] = await caller.recent();
    await caller.editRecent({ ...recentMilk!, category: "CARE" });
    assert.equal((await caller.recent())[0]!.ownItem.category, "CARE");
    const renamedRecent = await member.editRecent({
      ...recentMilk!,
      name: "Bread",
    });
    assert.equal(renamedRecent.ownItem.category, "CARE");
    const newOat = await caller.addManual({ name: "Oat drink" });
    await caller.remove({ id: newOat.id });
    const recentOat = (await caller.recent()).find(
      (item) => item.name === "Oat drink",
    )!;
    const known = await member.editRecent({ ...recentOat, name: "Bread" });
    assert.equal(known.ownItem.category, "OWN_ITEMS");
    await member.editRecent({ ...known, name: "Milk", category: "SNACKS" });
    assert.equal(
      (await caller.addManual({ name: "Milk" })).ownItem.category,
      "SNACKS",
    );
  }));

void test("the active list sorts by category then name while Recently Used and Usually Have keep their order", () =>
  withShoppingList(async ({ caller, member }) => {
    for (const name of [
      "Milk",
      "Beans",
      "Bread",
      "Carrots",
      "Apples",
      "A mystery",
    ]) {
      const item = await caller.addManual({ name });
      await caller.remove({ id: item.id });
      await caller.setUsuallyHave({ name, excluded: true });
    }
    assert.deepEqual(
      (await caller.recent()).map((item) => item.name),
      ["A mystery", "Apples", "Carrots", "Bread", "Beans", "Milk"],
    );
    assert.deepEqual(
      (await caller.usuallyHave()).map((item) => item.name),
      ["A mystery", "Apples", "Beans", "Bread", "Carrots", "Milk"],
    );
    for (const recent of await caller.recent())
      await caller.addRecent({ id: recent.id });
    assert.deepEqual(
      (await member.list()).map((item) => item.name),
      ["Apples", "Carrots", "Bread", "Milk", "Beans", "A mystery"],
    );
    const milk = (await caller.list()).find((item) => item.name === "Milk")!;
    await member.edit({ ...milk, category: "PRODUCE" });
    assert.deepEqual(
      (await caller.list()).map((item) => item.name),
      ["Apples", "Carrots", "Milk", "Bread", "Beans", "A mystery"],
    );
  }));

void test("Own Items survive clearing, dismissal, and Usually Have removal across shopping trips", () =>
  withShoppingList(async ({ caller, member, createDinner }) => {
    await caller.setUsuallyHave({ name: " Olive  oil ", excluded: true });
    const [preference] = await member.usuallyHave();
    assert.ok(preference?.id);
    assert.deepEqual(await caller.list(), []);
    assert.deepEqual(await caller.recent(), []);

    const dinner = await createDinner({ name: "OLIVE\tOIL" });
    const addition = await caller.addDinners({ dinnerIds: [dinner.id] });
    const [recent] = await member.recent();
    assert.equal(recent?.ownItemId, preference.id);
    await member.undo(addition.undo);
    assert.deepEqual(await caller.recent(), []);
    await member.setUsuallyHave({ name: "olive oil", excluded: false });
    assert.deepEqual(await caller.usuallyHave(), []);

    const manual = await caller.addManual({ name: "olive oil" });
    assert.equal(manual.ownItemId, preference.id);
    const measured = await member.edit({
      ...manual,
      amount: 1,
      unit: "l",
      note: null,
    });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    const active = await member.list();
    assert.equal(active.length, 2);
    assert.ok(active.every((item) => item.ownItemId === preference.id));
    assert.ok(
      active.some((item) => item.id === measured.id && item.note === null),
    );
    await caller.clear();
    const [cleared] = await member.recent();
    assert.equal(cleared?.ownItemId, preference.id);
    const restored = await member.addRecent({ id: cleared.id });
    assert.equal(restored.ownItemId, preference.id);
    await member.remove({ id: restored.id });
    const [removed] = await caller.recent();
    await caller.removeRecent({ id: removed!.id });
    assert.deepEqual(await caller.recent(), []);
    const nextTrip = await member.addManual({ name: "OLIVE   OIL" });
    assert.equal(nextTrip.ownItemId, preference.id);

    await withShoppingList(async ({ caller: other }) => {
      const otherOil = await other.addManual({ name: "Olive oil" });
      assert.notEqual(otherOil.ownItemId, preference.id);
    });
  }));

void test("deleting an Own Item forgets its category and collections only for its Household", () =>
  withShoppingList(async ({ caller, member }) => {
    const rice = await caller.addManual({ name: "Rice" });
    await caller.edit({ ...rice, category: "PETS" });
    await caller.remove({ id: rice.id });
    const [recent] = await member.recent();
    const restored = await member.addRecent({ id: recent!.id });
    await member.edit({ ...restored, amount: 1, unit: "kg" });
    await caller.addManual({ name: " RICE " });
    await caller.setUsuallyHave({ name: "Rice", excluded: true });
    const inherited = await caller.addManual({ name: "Rice special" });
    assert.equal(inherited.ownItem.category, "PETS");
    assert.equal((await caller.list()).length, 3);

    await withShoppingList(async ({ caller: other }) => {
      const otherRice = await other.addManual({ name: "Rice" });
      await other.edit({ ...otherRice, category: "SNACKS" });
      await other.deleteOwnItem({ id: rice.ownItemId });
      assert.equal((await caller.list()).length, 3);

      await member.deleteOwnItem({ id: rice.ownItemId });
      assert.deepEqual(
        (await caller.list()).map(({ name, ownItem }) => ({
          name,
          category: ownItem.category,
        })),
        [{ name: "Rice special", category: "PETS" }],
      );
      assert.deepEqual(await caller.recent(), []);
      assert.deepEqual(await caller.usuallyHave(), []);
      const addedAgain = await caller.addManual({ name: "rice" });
      assert.equal(addedAgain.ownItem.category, "GRAINS");
      assert.notEqual(addedAgain.ownItemId, rice.ownItemId);
      assert.equal((await other.list())[0]!.ownItem.category, "SNACKS");
    });
  }));

void test("Recently Used distinguishes variants and restores each latest quantity while other variants are active", () =>
  withShoppingList(async ({ caller, member }) => {
    const milk = await caller.addManual({ name: "Milk" });
    await caller.edit({ ...milk, amount: 1, unit: "l", note: "Whole milk" });
    const extra = await member.addManual({ name: " MILK " });
    await caller.remove({ id: milk.id });
    assert.equal((await member.recent())[0]?.note, "Whole milk");
    await member.edit({
      ...extra,
      amount: 200,
      unit: "ml",
      note: "For coffee",
    });
    await member.remove({ id: extra.id });
    const recent = await caller.recent();
    assert.deepEqual(
      recent.map(({ amount, unit, note }) => ({ amount, unit, note })),
      [
        { amount: 200, unit: "ml", note: "For coffee" },
        { amount: 1, unit: "l", note: "Whole milk" },
      ],
    );
    await member.addRecent({ id: recent[0]!.id });
    await caller.addRecent({ id: recent[0]!.id });
    assert.equal((await member.recent())[0]?.note, "Whole milk");
    const restored = await member.addRecent({ id: recent[1]!.id });
    assert.equal(restored.amount, 1);
    assert.equal(restored.unit, "l");
    assert.deepEqual(await member.recent(), []);
    assert.equal((await caller.list()).length, 2);
    await caller.edit({ ...restored, amount: 2 });
    await caller.remove({ id: restored.id });
    assert.equal((await caller.recent())[0]?.amount, 2);
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
      note: null,
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
    assert.equal(recent[1]!.note, null);
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
    await caller.edit({ ...milk, amount: 1, unit: "l", note: null });
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
    assert.ok(!(await member.recent()).some((item) => item.name === "Bread"));
    await member.remove({ id: bread.id });
    assert.ok((await member.recent()).some((item) => item.name === "Toast"));
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
    assert.deepEqual(
      (await caller.list()).map(({ id, amount, unit }) => ({
        id,
        amount,
        unit,
      })),
      [{ id: oil.id, amount: null, unit: null }],
    );
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
        { name: "2 Kg potatoes", amount: null, unit: null, note: null },
        { name: "Apples", amount: null, unit: null, note: null },
        { name: "Carrots", amount: 500, unit: "g", note: null },
        { name: "Zucchini", amount: null, unit: null, note: null },
        { name: "Oil", amount: null, unit: null, note: null },
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
      ["Apples", "Carrots", "Yukon potatoes", "Zucchini", "Oil"],
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
      ["Apples", "Carrots", "Zucchini", "Oil"],
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
      ["Apples", "Zucchini", ...Array<string>(7).fill("Tomatoes")],
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

void test("saving compatible quantities for the same normalized note combines in the destination unit", () =>
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
      note: "for  ROASTING",
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
          name: "POTATOES",
          amount: 1500,
          unit: "g",
          note: "for  ROASTING",
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
      note: "For roasting",
    });
    assert.equal(final.amount, 1750);
    assert.equal(final.note, "For roasting");
    assert.equal((await member.list()).length, 1);
  }));

void test("Undo reverses a repeated resolved Dinner batch while retaining pre-existing numeric and unquantified requirements", () =>
  withShoppingList(async ({ caller, member, createDinner, dinners }) => {
    const flour = await caller.addManual({ name: "Flour" });
    await caller.edit({
      id: flour.id,
      name: "Flour",
      amount: 500,
      unit: "g",
      note: "organic",
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
                name: " FLOUR organic ",
                amount: 1,
                unit: "kg",
                note: "Sifted",
              },
              { order: 1, name: "salt" },
              { order: 2, name: "Yeast", amount: 7, unit: "g" },
              { order: 3, name: "Water" },
              { order: 4, name: "Organic flour", amount: 2, unit: "handful" },
              { order: 5, name: "Organic flour" },
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
        { name: "Salt", amount: null, unit: null, note: null },
        { name: "Yeast", amount: 14, unit: "g", note: null },
        { name: "Flour", amount: 2500, unit: "g", note: "organic" },
        { name: "Flour", amount: 4, unit: "handful", note: "organic" },
        { name: "Flour", amount: null, unit: null, note: "organic" },
        { name: "Water", amount: null, unit: null, note: null },
      ],
    );
    // Shopping requirements and Undo survive deletion of the source Recipe.
    await dinners.delete({ dinnerId: dinner.id });
    assert.equal((await member.list()).length, 6);
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
        { name: "Toast", amount: null, unit: null, note: null },
        { name: "Soup", amount: null, unit: null, note: null },
        { name: "Takeaway", amount: null, unit: null, note: null },
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

void test("existing shopping details and reusable state survive the Own Item migration", async () => {
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
    const ownItemMigration = migrations.indexOf("20260915120000_own_items");
    execute(
      migrationSql(migrations.slice(firstProductMigration, ownItemMigration)),
    );
    execute(`
      UPDATE "ShoppingProduct" SET category = 'PETS' WHERE "normalizedName" = 'olive oil';
      UPDATE "ShoppingProduct" SET category = 'CARE' WHERE "normalizedName" = 'brown rice';
      INSERT INTO "ShoppingProduct" (id, "householdId", name, "normalizedName", category)
      VALUES ('remembered-only', 'migration-household', 'Spare bulbs', 'spare bulbs', 'HOUSEHOLD');
    `);
    execute(migrationSql(migrations.slice(ownItemMigration)));
    const caller = shoppingListRouter.createCaller({
      db,
      auth: { userId: "migration-user" },
    } as Parameters<typeof shoppingListRouter.createCaller>[0]);
    const settings = householdRouter.createCaller({
      db,
      auth: {
        userId: "migration-user",
        sessionClaims: { metadata: { householdId: "migration-household" } },
      },
    } as Parameters<typeof householdRouter.createCaller>[0]);
    assert.equal(
      (await settings.household()).household?.shoppingLanguage,
      "en",
    );
    const items = (await caller.list()).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
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
    const preferences = await caller.usuallyHave();
    const oil = preferences.find(
      (item) => item.normalizedName === "olive oil" && item.note === null,
    )!;
    assert.deepEqual(
      preferences.map(({ normalizedName, note }) => [normalizedName, note]),
      [
        ["olive oil", null],
        ["olive oil", "For salad"],
        ["olive oil", "Organic"],
        ["salt", null],
      ],
    );
    assert.ok(oil.id);
    assert.equal(new Set(items.map((item) => item.ownItemId)).size, 2);
    assert.ok(items.every((item) => item.ownItem.usuallyHave));
    assert.ok(items.every((item) => item.ownItem.category === "PETS"));
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
    assert.equal(recent[0]!.ownItem.category, "CARE");
    assert.equal(
      (await caller.addManual({ name: "Spare bulbs" })).ownItem.category,
      "HOUSEHOLD",
    );
    const restored = await caller.addRecent({ id: "latest" });
    assert.equal(restored.ownItemId, recent[0]!.ownItemId);
    await caller.clear();
    for (const item of await caller.recent())
      await caller.removeRecent({ id: item.id });
    await caller.setUsuallyHave({ name: "Olive oil", excluded: false });
    assert.equal(
      (await caller.addManual({ name: "Olive oil" })).ownItemId,
      oil.id,
    );
  } finally {
    await db.$disconnect();
    await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    await admin.$disconnect();
  }
});

void test("selecting previews remembers destinations, inherits categories once, and retains saved settings", () =>
  withShoppingList(async ({ caller, settings }) => {
    const source = await caller.addManual({ name: "Eggs" });
    await caller.edit({ ...source, category: "MEAT", usuallyHave: true });
    await caller.remove({ id: source.id });
    for (const recent of await caller.recent())
      await caller.removeRecent({ id: recent.id });
    const preview = suggestShoppingItems(
      "Eggs duck",
      await caller.sources(),
    ).find((item) => item.name === "Eggs" && item.note === "duck")!;
    assert.ok(preview);
    assert.equal(
      suggestShoppingItems("Eggs", await caller.sources()).filter(
        (item) => item.note === "duck",
      ).length,
      0,
    );
    const duck = await caller.addSelection(preview.selection);
    assert.equal(duck.ownItem.category, "MEAT");
    assert.equal(duck.ownItem.usuallyHave, false);
    assert.equal(duck.amount, null);
    assert.equal(duck.unit, null);
    await caller.edit({ ...duck, category: "PETS", usuallyHave: true });
    const plain = await caller.addSelection({ ownItemId: source.ownItemId });
    await caller.edit({ ...plain, category: "DAIRY" });
    const reused = await caller.addSelection(preview.selection);
    assert.equal(reused.id, duck.id);
    assert.equal(reused.ownItem.category, "PETS");
    assert.equal(reused.ownItem.usuallyHave, true);
    await settings.updateHousehold({ shoppingLanguage: "no" });
    assert.ok(
      suggestShoppingItems("Eggs", await caller.sources()).some(
        (item) => item.note === "duck",
      ),
    );
    assert.ok(
      suggestShoppingItems("Ost", await caller.sources()).some(
        (item) => item.name === "Ost" && "source" in item.selection,
      ),
    );
    assert.deepEqual(
      suggestShoppingItems("Cheese", await caller.sources()).filter(
        (item) => item.name === "Cheese",
      ),
      [
        {
          name: "Cheese",
          note: null,
          selection: { name: "Cheese", note: null },
        },
      ],
    );
    await withShoppingList(async ({ caller: other }) => {
      assert.equal(
        suggestShoppingItems("Eggs", await other.sources()).filter(
          (item) => item.note === "duck",
        ).length,
        0,
      );
      await assert.rejects(other.addSelection({ ownItemId: duck.ownItemId }));
      await assert.rejects(
        other.addSelection({
          name: "Eggs",
          note: "fresh",
          source: { ownItemId: source.ownItemId },
        }),
      );
      assert.deepEqual(await other.list(), []);
    });
  }));

void test("autocomplete and Dinner additions capitalize new names but keep existing spelling", () =>
  withShoppingList(async ({ caller, createDinner }) => {
    const fresh = await caller.addSelection({ name: "mIXED cASE", note: null });
    assert.equal(fresh.name, "Mixed case");
    await caller.edit({
      id: fresh.id,
      name: "mIXED cASE",
      note: null,
      amount: null,
      unit: null,
    });
    assert.equal(
      (await caller.addSelection({ name: "MIXED CASE", note: null })).name,
      "mIXED cASE",
    );
    const dinner = await createDinner({
      name: "Capitalization",
      parts: {
        create: {
          order: 0,
          ingredients: {
            create: [
              { order: 0, name: "MIXED CASE", amount: 2 },
              { order: 1, name: "fRESH sUPPLIES", amount: 3 },
            ],
          },
        },
      },
    });
    await caller.addDinners({ dinnerIds: [dinner.id] });
    const list = await caller.list();
    assert.ok(
      list.some((item) => item.name === "mIXED cASE" && item.amount === 2),
    );
    assert.ok(
      list.some((item) => item.name === "Fresh supplies" && item.amount === 3),
    );
  }));

void test("Clear returns the removed requirements and canonical Recently Used rows", () =>
  withShoppingList(async ({ caller }) => {
    const first = await caller.addManual({ name: "Clear first" });
    await caller.edit({ ...first, amount: 3, unit: "kg" });
    const second = await caller.addManual({ name: "Clear second" });
    const result = await caller.clear();
    assert.deepEqual(
      new Set(result.removedIds),
      new Set([first.id, second.id]),
    );
    assert.deepEqual(result.recentItems, await caller.recent());
    assert.equal(
      result.recentItems.find((item) => item.ownItemId === first.ownItemId)
        ?.amount,
      3,
    );
    assert.deepEqual(await caller.list(), []);
  }));

void test("retrying Clear only removes unchanged requirements from the original action", () =>
  withShoppingList(async ({ caller }) => {
    const original = await caller.addManual({ name: "Original" });
    const changed = await caller.addManual({ name: "Changed later" });
    await caller.edit({ ...changed, amount: 4 });
    const later = await caller.addManual({ name: "Later addition" });
    const result = await caller.clear({ items: [original, changed] });
    assert.deepEqual(result.removedIds, [original.id]);
    assert.deepEqual(
      new Set((await caller.list()).map((item) => item.id)),
      new Set([changed.id, later.id]),
    );
    assert.deepEqual(
      result.recentItems.map((item) => item.name),
      ["Original"],
    );
  }));
