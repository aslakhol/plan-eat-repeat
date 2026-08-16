# Meal Planning

Plan Eat Repeat helps a household maintain a shared collection of dinners and assign them to calendar days.

## Language

**Household**:
A group of people who share one Cookbook and one set of Plan Slots.
_Avoid_: Account, family

**Dinner**:
A reusable, household-owned meal idea with a name. A Dinner may have tags, notes, and an optional Recipe.
_Avoid_: Meal, dish, recipe

**Recipe**:
The optional structured cooking content attached to a Dinner. A Recipe may contain multiple named parts, ingredients, and steps; it is not managed independently from its Dinner.

**Name-only Dinner**:
A Dinner that has a name but no Recipe or notes.
_Avoid_: Bare dinner, empty dinner

**Notes-only Dinner**:
A Dinner that has notes but no Recipe.
_Avoid_: Recipe-less dinner, un-recipe'd dinner

**Cookbook**:
The Household's collection of active Dinners.
_Avoid_: Dinner library, Dinners

**Plan Slot**:
The assignment of one Dinner to one Household calendar date. A Plan Slot identifies a date, not an instant in time.
_Avoid_: Plan entry, planned day

**Cooking History**:
The Household's past Plan Slots, which are presumed to represent Dinners that were cooked. Changing or clearing a past Plan Slot corrects this history; deleting a Dinner removes its history.

**Cooking Frequency**:
The number of past Plan Slots in which a Dinner occurs for the Household.

**Favourite**:
A Household-shared designation applied to a Dinner.
_Avoid_: Personal favourite, favorite

**Import Draft**:
Unsaved Dinner editor content produced from an import source. It changes the Cookbook only when the user saves it; cancelling discards it.

**Source Link**:
The optional URL associated with a Dinner that identifies the source of its Recipe.
_Avoid_: Recipe link

**Clear Recipe**:
An editor action that removes a Dinner's Recipe parts and serving count while preserving its name, tags, notes, and Source Link.

**Merge Dinners**:
An irreversible Cookbook action that retains one of two household Dinners, preserves every distinct past and future planned date under it, and then deletes the other without combining Dinner content.
_Avoid_: Merge Cooking History, combine recipes
