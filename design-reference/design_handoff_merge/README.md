# Handoff: Merge dinners (Plan Eat Repeat)

## Overview

A household accumulates duplicate dinners — two entries for "Spaghetti carbonara". Deleting one loses its Plan Slots, so **Merge** consolidates two dinners into one while preserving every planned date. This handoff defines the full selection and confirmation experience.

**Merge reassigns Plan Slots only.** One Dinner is retained entirely unchanged; the other is deleted. No Dinner field is combined. Both past and future Plan Slots move.

Merge is pairwise and may operate on any two distinct Dinners in the Household. "Duplicate" is the user's judgment: do not add name, tag, or Recipe-similarity checks. A Household with more than two duplicates can repeat the flow.

## About the design files

`Merge.dc.html` is the design-review document. The canonical screens are the section labeled **4 / 4a at the top**; sections 1–3 below it are the explorations that led there (kept for context, not for implementation). `screens/` holds 2x screenshots of each canonical screen. **When sources disagree, this README is authoritative.** In particular, the current screenshots do not yet show the accepted Back affordance on the keeper screen, and the result screenshot still shows a kept-row highlight that is no longer required.

These are **design references in HTML**, not production code. Recreate in the existing app with `@planeatrepeat/web`, semantic tokens, Quicksand for UI text, Young Serif for dinner names and page titles, `rounded-lg` (0.75rem). Hex values quoted below are what the prototype renders — prefer the matching token.

This feature is scoped to the responsive web app. Expo parity is deferred.

## Prerequisites

Read `design_handoff_cookbook/README.md` first. Every component in this flow already exists there: the dinner sheet, its ••• menu, the dinner picker (search + funnel + three sorts + "x wks ago" column), the warm row fill, and the bottom-sheet shape. Nothing here is a new component except the two keeper cards on screen 3.

## Flow

### 1. Entry — ••• menu (`screens/01-dinner-menu.png`)

**Merge** is the middle row of the dinner sheet's existing ••• menu: _Add to favourites_ / **Merge** / _Delete dinner_. Plain word, no icon, 13.5px 600, no dimming beneath, menu opens below the button. Use the short label **Merge** everywhere, not "Merge dinner".

Show this action only in the Cookbook Dinner view's menu, not in the planned-day or Dinner editor menus. Hide the Merge row unless the summaries query has succeeded and the Household has at least two Dinners; do not show a disabled or error-state row while availability is unknown, and do not open a picker with no valid choice.

**This is the only entry point.** Not on cookbook list rows, no swipe, no long-press.

The dinner whose menu was opened is the **origin dinner**. It has no privileged status in the merge — it is only the dinner you started from.

### 2. Pick the other dinner (`screens/02-pick-other-dinner.png`)

The menu closes and a single Merge sheet opens above the Dinner sheet. Its first state **reuses the existing dinner picker**:

- Title line: "Merge **Spaghetti Carbonara** with…" (13px 600 centered, name in Young Serif).
- Search input + 44px funnel button; the same tag-filter sheet.
- Sort segmented control, **A–Z default** (matching the Cookbook list, not the day picker).
- All household dinners, immediately scrollable, "x wks ago" right column, count caption at the end.
- **The origin dinner stays in the list in place but is inert** (muted "— this one" suffix, not tappable) so the list does not shift or appear to be missing an entry.
- Search and tag filters may hide the origin like any other non-matching row. Whenever it is visible, it remains inert and marked "— this one"; do not force it into filtered results.
- Scoped to the current household. No cross-household dinner may ever appear.

Tapping a Dinner fetches its complete detail for the keeper cards; do not load every full Recipe into the picker query. Keep the picker visible while loading, show the tapped row as busy, and disable all choices. On success, advance to screen 3 with no confirmation at this step. On failure, remain in the picker, restore its controls, show the existing error toast with **"Something went wrong."**, and let the user tap the row again.

The picker may open the existing tag-filter sheet above the Merge sheet. Dismissing the tag filter returns to the picker; dismissing the Merge sheet returns to the underlying Dinner sheet.

If active filters leave the inert origin as the only matching row, keep that row visible and show "No other dinners match" with the existing Clear filters action. Determine this state from actionable candidates rather than the raw matching-row count.

### 3. Choose which one is kept (`screens/03-choose-keeper.png`)

The sheet hugs its content: title, two cards, one note, one button.

- Title: "Which one do you want to keep?"
- A compact left chevron beside the centered title returns to the picker and preserves its search, tags, sort, and scroll position so the user can choose a different second Dinner. Its accessible label is "Back to dinner picker".
- **Two keeper cards side by side, equal width, `bg-muted` `#F7F4EE`, 1.5px `#eee8db`, 14px radius.** Origin dinner on the left, the picked one on the right.
- Treat the cards as a single labelled radio group with two full-card radio controls. Support keyboard selection, show visible focus, and associate the irreversible-action note with the group using `aria-describedby`.
- Card content, top to bottom:
  1. Dinner name (Young Serif ~16.5px, wraps) with a **19px empty radio tick** at the top-right.
  2. History line: "14 times · 3 wks ago" (11px 600 muted). A Dinner with no past Plan Slots reads "0 times · never made", even when it has future Plan Slots.
  3. **Content peek**, above a hairline rule — this is what makes two same-named dinners distinguishable:
     - If the dinner has ingredients: the **first three ingredient names** (names only, no quantities), then a muted "+ 4 more · 3 steps" line. Fewer than three ingredients: list what there is. No steps: omit the step count.
       - For multipart Recipes, flatten parts by stored part order and ingredients by stored ingredient order. Preserve repeated ingredient names rather than deduplicating them.
       - Build the muted summary from the segments that exist: `+ N more` only when additional ingredients remain and `N steps` only when steps exist, joined by `·`. Omit the summary line when neither segment exists.
     - If it has no ingredients: show what it _does_ have instead — the **note** in quotes (one line, truncated) and/or the **link host**. **Never print a line stating the absence** ("No ingredients", "Notes only"). An empty slot says it.
       - A steps-only Recipe shows `N steps` as its content peek. Do not show step text.
     - If it has neither: the slot is omitted and the card is shorter. Cards need not match height.
     - This is a representative preview, not a complete field-by-field diff. Favourite status, servings, notes, and Source Link may be absent when ingredients take precedence; do not expand the cards to expose every possible difference.
  4. Tags, muted, single line clipped (11px 600) at the card floor.
- **Note above the button, verbatim, three sentences:**
  > The one you keep stays exactly as it is. The other is deleted. Only the planned dates move across.
- **Button: "Merge".** Disabled/inert until a card is tapped. **No default selection** — the merge is irreversible, so the choice must be an explicit act.
- Keep the two cards side by side throughout the supported 320–480px mobile range. Names wrap and the sheet may scroll rather than switching to a stacked layout. Use the existing responsive-dialog treatment on desktop.
- On desktop, use a tall, scrollable `max-w-xl` picker dialog and a content-sized `max-w-[680px]` keeper dialog. Preserve the mobile states and copy rather than introducing a separate desktop design.

### 4. Chosen state (`screens/04-chosen.png`)

Tapping a card selects it. Selection is a toggle between the two, never both, never neither once one is picked.

- **Kept card**: white fill, 1.5px primary `#DD6B42`, soft primary shadow, tick filled primary with a white checkmark, peek rule tints to `#efc9ba`.
- **Other card**: dims to ~62% opacity, tick stays empty.
- **The tag line is replaced by a state label**: `KEEPING` (primary) / `DELETING` (muted), 10.5px 700, letter-spaced. The content peek stays visible — whatever the user identified the dinner by is still on screen at the moment of committing.
- Tags intentionally disappear when the state labels replace them; do not retain a second tag row in the chosen state.
- **The note text does not change between the unchosen and chosen states.** It is a standing statement of the rule, not a per-selection summary.
- Button becomes primary "Merge".

After the user taps Merge, disable both cards, the Back affordance, and the button, replace the button content with a small spinner and **"Merging…"**, and ignore sheet-dismiss attempts while the mutation is pending. Restore interaction and the **"Merge"** label if it fails.

### 5. Result (`screens/05-merged-toast.png`)

On confirm: both sheets close to the default A–Z Cookbook list, with search and tag filters reset. The list is one row shorter. No special row highlight is required.

Invalidate the existing Dinner and Plan query families before returning to `/dinners`; prefer broad family invalidation to maintaining several cache patches by hand.

**Toast copy: "Merged into Spaghetti Carbonara."** No Undo, no count.

- No count on purpose: a same-date collision (below) means the number of records that actually land can be lower than the number the user might expect. The confirm step carries the weight instead.
- **The toast styling in the prototype is not final — use the app's existing toast component as-is. Only the wording is specified.**

## Data behaviour (required)

Let **K** = the kept dinner, **D** = the discarded one.

1. **K is untouched.** Name, recipe, ingredients, steps, notes, link, tags, favourite status, serving count, and every other field remain exactly as they were. Nothing is copied from D — not one field, not as a fallback for an empty field on K.
2. **All of D's Plan Slots are re-pointed to K, past and future.** Every distinct planned date belonging to either Dinner must still be present, and referencing K, after the merge.
3. **Same-date collision:** in normal use only one Dinner is planned per date, but the database does not enforce it and legacy data may violate it. For every date represented by D, the result holds **exactly one K/D Plan Slot** for that date, referencing K. Prefer an existing K record; otherwise re-point one D record. Delete any other K/D records for that date. **Resolve silently** — no prompt, no warning, nothing surfaced in the UI. Do not clean up duplicate K-only dates that D did not share, and do not remove or change a same-date Plan Slot belonging to an unrelated third Dinner.
4. **D is deleted only after its Plan Slots have been transferred.**
5. **Atomic.** The whole operation is one transaction. A transaction failure leaves both Dinners and all Plan Slots exactly as they were — never Plan Slots partially moved or a Dinner partially deleted.
6. **Household-scoped.** Both dinners must belong to the caller's household; enforce server-side, not only in the picker query.
7. **No undo** is provided, in the UI or the API.
8. **Any Household member may merge.** Use the same authorization level as the existing Dinner edit and delete actions.

For collision detection, "same date" means exact equality of the stored `Plan.date` values. Do not add timezone normalization or date-only database hardening as part of Merge.

## Freshness and concurrency

The keeper cards are a preview, not a locked snapshot. Do not add optimistic-version checks: the server operates on the current Dinner and Plan Slot data when the user taps Merge, even if a Dinner changed after the preview loaded.

Do not add special locking, transaction isolation, or retry handling for concurrent planning or editing. The required transaction still guarantees atomicity. A database conflict or race may follow the ordinary failure path below.

## API contract

Expose a Household-protected mutation shaped as `merge({ keptDinnerId, discardedDinnerId })`; the origin Dinner is UI state and is not part of the contract. Reject identical IDs and verify server-side that both Dinners belong to the caller's Household. Do not validate that their names, tags, or Recipes are similar. Return only the kept Dinner's current `{ id, name }`, which drives navigation and toast copy.

## Client state and navigation

The Dinner sheet remains the URL-addressed layer. Merge is transient local UI state with no route or synthetic browser-history entries. The visible keeper Back control returns to the picker, and standard sheet dismissal closes the entire Merge flow; browser Back may leave the Dinner view rather than unwinding Merge one state at a time.

Within one open Merge session, keeper → Back preserves picker search, tags, sorting, and scroll position. Dismissing and invoking Merge again starts a fresh session at the A–Z picker with no search, tags, or keeper selection.

## Analytics

After a successful merge, emit one PostHog event containing the kept Dinner ID, discarded Dinner ID, and whether the origin Dinner was kept. Do not include Dinner names and do not emit events for picker activity, cancellation, failure, or other intermediate states.

## Failure

If the mutation reports an error, both sheets stay open on the chosen state, interaction is restored, and the app's existing error toast says **"Something went wrong."** Do not expose technical details or claim whether the server committed.

## Release and verification

Ship Merge directly without a feature flag.

Keep automated coverage light. Test the collision/transfer decision as a small pure helper, with the important cases grouped in one test file. Do not introduce a database test harness, broad router suite, Playwright flow, or visual snapshots solely for Merge. Manually smoke-test the happy path, required keeper selection, Back-state preservation, and error state; continue to run the repository's normal lint and typecheck checks during implementation.

## Acceptance criteria mapping

| Criterion                                                                   | Where                                 |
| --------------------------------------------------------------------------- | ------------------------------------- |
| ••• menu includes the merge action                                          | Screen 1                              |
| Select another dinner from the same household                               | Screen 2                              |
| Any distinct pair is allowed; additional duplicates merge pairwise          | Overview, API contract                |
| User chooses which dinner is retained                                       | Screens 3–4, explicit tap, no default |
| Retained dinner unchanged                                                   | Data 1                                |
| No data copied from the discarded dinner                                    | Data 1                                |
| Every distinct past and future planned date preserved and re-pointed        | Data 2                                |
| Same-date K/D collision → one of their records; unrelated records untouched | Data 3, silent                        |
| Discarded dinner removed only after transfer                                | Data 4                                |
| Atomic                                                                      | Data 5                                |
| Selection and confirmation experience defined                               | This document                         |
