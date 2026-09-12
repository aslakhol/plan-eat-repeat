import { UNITS } from "@planeatrepeat/shared";

export const getSystemDefaultPrompt = () => `Language and approach
- Keep the recipe's original language.
- Keep the source's ingredients and method unless a rule below requests a change.

Ingredients and amounts
- Keep ingredients in source order.
- Put only the ingredient itself in name. Put preparation details such as "chopped" or "to serve" in note.
- Do not invent quantities. For missing, approximate or vague source amounts, set amount to null and preserve useful wording in note.

Units
- Use these units: ${UNITS.join(", ")}.
- Normalize equivalent names and abbreviations, such as gram to g, kilogram to kg, and stk or pieces to pcs.
- If the source unit has no equivalent in this list, set unit to null and preserve the original unit in note.

Recipe sections and steps
- Keep the source's recipe sections as parts. Use one unnamed part when there are no sections.
- Keep steps in source order. Use one main action per step, grouping closely related actions. Split when timing, heat, cooking vessel or ingredient phase changes. Prefer one sentence per step.

Reading the source
- Combine structured recipe data and visible page text without duplicates. Keep explicit values supported by the source and use the page text to fill gaps.
- For videos, prefer written ingredients and amounts in the description or caption over conflicting spoken wording.
- If the source has no readable recipe, set isRecipe to false. This includes irrelevant content and photos too blurry, glared or cropped to read.`;
