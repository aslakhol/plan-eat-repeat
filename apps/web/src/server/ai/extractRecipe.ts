import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, type FilePart, type TextPart } from "ai";
import { z } from "zod";
import { UNITS, recipeSchema, type RecipeInput } from "@planeatrepeat/shared";

import { env } from "~/env";

export type ExtractInput = {
  parts: Array<
    | { type: "text"; text: string }
    | { type: "image"; image: Uint8Array; mimeType: string }
  >;
  instructions?: string;
};

export type ExtractResult = { name: string; recipe: RecipeInput };

const extractRecipeSchema = z.object({
  name: z.string().trim().min(1),
  recipe: recipeSchema,
});

const systemPrompt = `You extract structured dinner recipes for review before saving.

Return only data that is supported by the provided source. Keep the recipe's original language for the name, ingredient names, notes, part names, and steps.

Normalize ingredient units to one of these exact values: ${UNITS.join(", ")}.
- Map Norwegian long and short forms to the shared units when present: gram -> g, kilo/kilogram -> kg, milliliter -> ml, desiliter -> dl, liter -> l, spiseskje/ss -> ss, tablespoon/tbsp -> tbsp, teskje/ts -> ts, teaspoon/tsp -> tsp, stk/stykk/piece/pieces -> pcs.
- If no exact shared unit applies, set unit to null and keep the source wording in note when useful.

Never guess amounts. If an amount is unstated, approximate, vague, or only implied (for example "a handful", "some", "to taste"), set amount to null. Set unit to null unless the unit is explicitly stated and normalized above.

Ingredient name should be the ingredient itself. Put preparation notes such as "finhakket", "chopped", "revet", "room temperature", or "to serve" in note, not in name.

Map recipe sections to recipe parts. For simple recipes with no named sections, use a single part with name null. Preserve step order and ingredient order.`;

export const extractRecipe = async (
  input: ExtractInput,
): Promise<ExtractResult> => {
  const content: Array<TextPart | FilePart> = input.parts.map((part) => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    }

    return {
      type: "file",
      data: part.image,
      mediaType: part.mimeType,
    };
  });

  const instructions = input.instructions?.trim();
  if (instructions) {
    content.unshift({
      type: "text",
      text: `Household import preferences, bounded by the required schema and source fidelity:\n${instructions}`,
    });
  }

  const result = await generateObject({
    model: anthropic(env.AI_EXTRACT_MODEL),
    schema: extractRecipeSchema,
    schemaName: "ExtractedRecipe",
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  return result.object;
};
