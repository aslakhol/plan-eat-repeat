import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";

import { createPrismaClient, type PrismaClient } from "@planeatrepeat/db";
import { editorIngredientValues } from "../lib/recipe-editor-values";

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
    auth: {
      userId,
      sessionClaims: { metadata: { householdId: household.id } },
    },
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

void test("custom units and unspecified quantities survive editing, reloading, and a Published Dinner copy", () =>
  withDinnerCaller(async ({ caller, marker }) => {
    const ingredients = [
      { name: "mango", amount: 1.5, unit: "  large cheeks  ", note: "diced" },
      { name: "coriander", amount: null, unit: "handful", note: null },
      { name: "onion", amount: 2, unit: null, note: "original unit in note" },
      { name: "lime", amount: 1, unit: "pcs", note: null },
      { name: "salt", amount: null, unit: "  ", note: "to taste" },
    ];
    const { dinner } = await caller.create({
      dinnerName: `Custom units ${marker}`,
      tagList: [],
      link: null,
      recipe: {
        servings: 2,
        parts: [{ name: null, ingredients, steps: [] }],
      },
    });
    const loaded = await caller.get({ dinnerId: dinner.id });
    assert.ok(loaded.dinner);
    const part = loaded.dinner.parts[0]!;
    const editedIngredients = part.ingredients.map((ingredient) => {
      const draft = editorIngredientValues(ingredient);
      return {
        ...draft,
        amount: draft.amount === "" ? null : Number(draft.amount),
        note: draft.note || null,
      };
    });
    await caller.edit({
      dinnerId: dinner.id,
      dinnerName: dinner.name,
      tagList: [],
      link: null,
      recipe: {
        servings: 2,
        parts: [{ name: null, ingredients: editedIngredients, steps: [] }],
      },
    });
    const reloaded = await caller.get({ dinnerId: dinner.id });
    assert.deepEqual(
      reloaded.dinner?.parts[0]?.ingredients.map(
        ({ name, amount, unit, note }) => ({
          name,
          amount,
          unit,
          note,
        }),
      ),
      [
        { name: "mango", amount: 1.5, unit: "large cheeks", note: "diced" },
        { name: "coriander", amount: null, unit: "handful", note: null },
        { name: "onion", amount: 2, unit: null, note: "original unit in note" },
        { name: "lime", amount: 1, unit: "pcs", note: null },
        { name: "salt", amount: null, unit: null, note: "to taste" },
      ],
    );
    const { publicSlug } = await caller.publish({ dinnerId: dinner.id });
    await withDinnerCaller(async ({ caller: destination }) => {
      const copy = await destination.savePublished({ publicSlug });
      const saved = await destination.get({ dinnerId: copy.dinner.id });
      assert.deepEqual(
        saved.dinner?.parts[0]?.ingredients.map(
          ({ name, amount, unit, note }) => ({
            name,
            amount,
            unit,
            note,
          }),
        ),
        reloaded.dinner?.parts[0]?.ingredients.map(
          ({ name, amount, unit, note }) => ({
            name,
            amount,
            unit,
            note,
          }),
        ),
      );
    });
  }));

void test("ingredient suggestions include distinct units from only the caller's Household", () =>
  withDinnerCaller(async ({ caller, db, householdId }) => {
    await db.dinner.create({
      data: {
        name: "Unit suggestions",
        householdId,
        parts: {
          create: {
            order: 0,
            ingredients: {
              create: [
                { order: 0, name: "mango", unit: "cheek" },
                { order: 1, name: "mango", unit: "cheeks" },
                { order: 2, name: "coriander", unit: " handful " },
                { order: 3, name: "parsley", unit: "handful" },
                { order: 4, name: "salt", unit: " " },
                { order: 5, name: "onion", unit: null },
                { order: 6, name: "butter", unit: "g" },
              ],
            },
          },
        },
      },
    });
    await withDinnerCaller(async ({ caller: otherCaller }) => {
      await otherCaller.create({
        dinnerName: "Private suggestion",
        tagList: [],
        link: null,
        recipe: {
          servings: null,
          parts: [
            {
              name: null,
              ingredients: [
                {
                  name: "secret ingredient",
                  amount: 1,
                  unit: "secret unit",
                  note: null,
                },
              ],
              steps: [],
            },
          ],
        },
      });
      const suggestions = await caller.ingredientNames();
      assert.deepEqual(suggestions.ingredientNames, [
        "butter",
        "coriander",
        "mango",
        "onion",
        "parsley",
        "salt",
      ]);
      assert.deepEqual(suggestions.ingredientUnits, [
        "g",
        "kg",
        "ml",
        "dl",
        "l",
        "tbsp",
        "tsp",
        "pcs",
        "cheek",
        "cheeks",
        "handful",
      ]);
    });
    const signedOut = dinnerRouter.createCaller({
      db,
      auth: { userId: null },
    } as Parameters<typeof dinnerRouter.createCaller>[0]);
    assert.deepEqual(await signedOut.ingredientNames(), {
      ingredientNames: [],
      ingredientUnits: ["g", "kg", "ml", "dl", "l", "tbsp", "tsp", "pcs"],
    });
  }));
