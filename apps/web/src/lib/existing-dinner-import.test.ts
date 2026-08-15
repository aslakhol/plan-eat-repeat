import assert from "node:assert/strict";
import test from "node:test";
import type { RecipeInput } from "@planeatrepeat/shared";

import {
  applyExistingDinnerImport,
  clearExistingDinnerRecipe,
} from "./existing-dinner-import";
import type { RecipeEditorDraftValues } from "./recipe-editor-values";

const existing: RecipeEditorDraftValues = {
  name: "Taco night",
  tags: ["Quick", "Family"],
  newTag: "",
  link: "https://ours.example/tacos",
  notes: "Double the salsa.",
  recipe: {
    servings: 2,
    parts: [
      {
        name: "Old filling",
        ingredients: [
          { name: "Beans", amount: "1", unit: "pcs", note: "drained" },
        ],
        steps: [{ text: "Warm the beans." }],
      },
    ],
  },
};

const importedRecipe: RecipeInput = {
  servings: 4,
  parts: [
    {
      name: "New filling",
      ingredients: [{ name: "Lentils", amount: 200, unit: "g", note: null }],
      steps: ["Cook the lentils."],
    },
  ],
};

void test("URL import replaces Recipe content but preserves Household knowledge", () => {
  const result = applyExistingDinnerImport(existing, {
    name: "Imported tacos",
    recipe: importedRecipe,
    sourceLink: "https://source.example/tacos",
  });

  assert.deepEqual(result.values.tags, existing.tags);
  assert.equal(result.values.notes, existing.notes);
  assert.equal(result.values.name, existing.name);
  assert.equal(result.values.link, existing.link);
  assert.deepEqual(result.values.recipe, {
    servings: 4,
    parts: [
      {
        name: "New filling",
        ingredients: [{ name: "Lentils", amount: "200", unit: "g", note: "" }],
        steps: [{ text: "Cook the lentils." }],
      },
    ],
  });
  assert.equal(result.importedNameAlternative, "Imported tacos");
  assert.equal(
    result.importedSourceLinkAlternative,
    "https://source.example/tacos",
  );
});

void test("photo and text imports preserve an existing Source Link", () => {
  const result = applyExistingDinnerImport(existing, {
    name: "Taco night",
    recipe: importedRecipe,
    sourceLink: null,
  });

  assert.equal(result.values.link, existing.link);
  assert.equal(result.importedSourceLinkAlternative, null);
});

void test("an empty existing Source Link silently accepts an imported URL", () => {
  const result = applyExistingDinnerImport(
    { ...existing, link: "" },
    {
      name: "Taco night",
      recipe: importedRecipe,
      sourceLink: "https://source.example/tacos",
    },
  );

  assert.equal(result.values.link, "https://source.example/tacos");
  assert.equal(result.importedSourceLinkAlternative, null);
});

void test("Clear Recipe only removes servings and Recipe parts", () => {
  const result = clearExistingDinnerRecipe(existing);

  assert.deepEqual(result, {
    ...existing,
    recipe: { servings: null, parts: [] },
  });
});
