# Recently used shopping items

Agreed product decisions for [issue #268](https://github.com/aslakhol/plan-eat-repeat/issues/268), confirmed by the request to implement on 2026-09-14.

## Confirmed

- Recently Used belongs to the Household, like its Shopping List.
- Show at most 25 distinct ingredient names, ordered by most recent removal or exclusion when adding from Dinners. Entries do not expire with time.
- Match names ignoring capitalisation and surrounding whitespace. Repeated occurrences occupy one entry and retain the latest item's quantity, unit, and note.
- Adding a recent item restores those retained details.
- A name already present on the Shopping List does not appear in Recently Used, regardless of how it was added or how many Shopping Items share that name.
- Adding one of 25 recent names to the Shopping List can leave 24 displayed entries. There is no requirement to retain extra history or backfill hidden names to keep 25 visible. Choose the simplest implementation for retention and where the limit is applied; a frontend display limit is acceptable.
- Removing an item through its row or edit sheet, and clearing the Shopping List, populate Recently Used. Undoing a dinner addition and merging rows during editing do not count as removals for this purpose.
- Ingredients excluded through Usually Have enter Recently Used instead of the Shopping List when adding from Dinners.
- A skipped ingredient replaces any existing recent entry's quantity and unit, clears its note, and moves it to the top.
- Undoing a dinner addition reverses its changes to both the Shopping List and Recently Used, preserving subsequent changes made by Household members.
- Recent entries support the same editing and removal controls as normal Shopping Items, as well as adding them back to the Shopping List.
- Tapping a recent row adds it to the Shopping List. Its quantity button and edit control open an editor for name, quantity, unit, note, and the Usually Have switch.
- Saving edits changes the recent entry in place without adding it to the Shopping List or changing its recency. The Usually Have switch updates the Household preference as it does in the normal Shopping Item editor.
- Removing a recent entry forgets it. A later Shopping List removal or dinner exclusion can create it again.
- Renaming to another recent name leaves one entry, with the edited details and the newer of the two original recency positions. The rule hiding active Shopping List names also applies after renaming.
- Place the section below the shopping items. Hide it when there are no recent items to display.
- Use an accordion, initially expanded, with its open/closed choice remembered on the device using localStorage.
- Keep the existing empty Shopping List appearance and add controls when recent items exist. Move the empty state upward as needed to accommodate the accordion.

## Bulk operations

- Default to alphabetical ordering for entries with the same recency from one operation.
- For duplicate names within one operation, keep the last occurrence's details without summing quantities. Use Shopping List display order when clearing, and dinner-selection then Recipe order for excluded ingredients.
- These tie-breaking choices are low priority. Prefer simpler implementation if enforcing them would add complexity, while preserving one entry per name and most-recent-first ordering across separate operations.

## Existing behavior to preserve

- Usually Have does not prevent manual additions or remove existing Shopping Items.
- Dinner additions currently omit Recipe Ingredient notes when creating Shopping Items.
- The current app does not retain removed Shopping Items, so historical removals cannot seed this section.
