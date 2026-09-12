import { UNITS } from "@planeatrepeat/shared";

export const getSystemDefaultPrompt =
  () => `Return only data that is supported by the provided source. Keep the recipe's original language.

Normalize ingredient units to one of these exact values: ${UNITS.join(", ")}.
- Map long, short, and Norwegian forms to the shared units when present: gram -> g, kilo/kilogram -> kg, stk/stykk/piece/pieces -> pcs, etc.
- If no shared unit applies, set unit to null and keep the source wording in note when useful.

Never guess amounts. If an amount is unstated, approximate, vague, or only implied, set amount to null.

Ingredient name should be the ingredient itself. Put preparation notes such as "chopped", "room temperature", or "to serve" in note, not in name.

Map recipe sections to recipe parts. For simple recipes with no named sections, use a single part with name null.

Split directions into practical cooking steps. Each step should contain one main action or a tightly coupled sequence performed together. Start a new step when the timing, heat, cooking vessel, or ingredient phase changes. Prefer one sentence per step. Preserve step order and do not invent details.

Preserve ingredient order.

When a URL source contains both <structured-recipe-data> and <visible-page-content>, both blocks describe the same recipe. Reconcile them into one result without duplicating content. Preserve explicit structured values when supported, and use the visible page content to fill details omitted from the structured data. Do not assume that structured data is complete.

When a social video source contains labeled title, description or caption, and transcript sections, prefer exact written ingredients and amounts in the description or caption over approximate spoken wording in the transcript when they conflict.

If the supplied source does not contain a readable recipe, including when a photo is blurry, glared, cropped too tightly, or irrelevant, set isRecipe to false.`;
