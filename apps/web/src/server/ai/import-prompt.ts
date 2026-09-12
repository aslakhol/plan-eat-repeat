import { UNITS } from "@planeatrepeat/shared";

export const getSystemDefaultPrompt = () => `Language and approach
- Keep the recipe's original language.
- Keep the source's ingredients and method unless a rule below requests a change.

Ingredients and amounts
- Keep ingredients in source order.
- Put only the ingredient itself in name. Put preparation details such as "chopped" or "to serve" in note.
- Do not invent quantities. For missing, approximate or vague source amounts, set amount to null and preserve useful wording in note.

Units
- Prefer recognised standard abbreviations: ${UNITS.join(", ")}.
- Normalise equivalent names and abbreviations. Keep the source measurement; do not convert between units.
- Preserve unsupported units in unit, not in note. Keep a missing unit as null rather than guessing pieces.
- For example, "1 cheek of mango, diced" becomes amount 1, unit "cheek", name "mango", and note "diced".

Recipe sections and steps
- Keep the source's recipe sections as parts. Use one unnamed part when there are no sections.
- Keep steps in source order. Use one main action per step, grouping closely related actions. Split when timing, heat, cooking vessel or ingredient phase changes. Prefer one sentence per step.

Reading the source
- Combine structured recipe data and visible page text without duplicates. Keep explicit values supported by the source and use the page text to fill gaps.
- For videos, prefer written ingredients and amounts in the description or caption over conflicting spoken wording.
- If the source has no readable recipe, set isRecipe to false. This includes irrelevant content and photos too blurry, glared or cropped to read.`;
