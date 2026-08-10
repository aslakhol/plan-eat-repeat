# Mobile Web Redesign Implementation Sequence

## Goal

Implement the Week, Cookbook, and add/import handoffs as one coherent mobile-browser redesign of the Next.js app. Preserve the recently implemented Recipe editor/viewer and import acquisition pipeline unless a handoff names a concrete change. Keep desktop functional with the existing sidebar and responsive patterns. Expo is out of scope.

The three handoff READMEs are the product specifications. When sources conflict, use this order:

1. Handoff README
2. Canonical screenshot/HTML
3. Current behavior
4. Old issues

## Deferred deliberately

- Expo parity
- Desktop visual redesign
- AI tag suggestions
- YouTube metadata preview
- Merge
- Date-only Plan Slot storage
- Database uniqueness for one Plan Slot per Household/date
- Broad automated-test infrastructure

## Change set 1: Dinner summaries and household-safe planning APIs

Start with non-visual backend work so every redesigned list consumes one consistent summary shape.

### Data

- Add a Household-shared `favourite` boolean to `Dinner`, defaulting to false.
- Create and apply the Prisma migration, then regenerate the client.
- Keep the existing hard-delete cascade from Dinner to Plan. Do not add archival state.
- Do not change Plan date storage or add the deferred Household/date unique constraint.

### Dinner summary query

Create one Household-scoped summary contract used by Cookbook and the Week picker. It should return:

- the active Dinner and tags;
- `lastCookedDate`, derived from the latest Plan Slot before today;
- `cookingFrequency`, the number of Plan Slots before today;
- Plan Slots in the current ISO week, used for `tonight`/weekday labels;
- the Household-shared favourite flag.

Pass the viewer's local `today` and current-week boundaries into the query so the server does not guess the browser's calendar date. Use grouped Plan queries rather than loading every historical row per Dinner.

Add a Household-scoped favourite mutation and invalidate the summary query after toggling.

### Planning safety within the existing model

Without implementing the deferred uniqueness migration:

- require a Household for planning mutations;
- verify the selected Dinner belongs to that Household;
- scope `plansForDinner` to the Household before using it in deletion confirmation;
- preserve the current sequential find-and-replace behavior;
- do not add concurrency versioning or Undo/inverse APIs.

### Completion check

- Active Dinner summaries produce correct past-only recency/frequency and current-week labels.
- Favourite changes are shared by Household members.
- Cross-Household Dinner IDs cannot be planned or inspected.
- Existing hard deletion still removes every associated Plan Slot.

## Change set 2: Shared mobile shell, routing, and collection controls

Build the navigation and shared primitives before either page-specific redesign.

### Application shell

- Replace the mobile bottom navigation with text-only **Week · ＋ · Cookbook**.
- Keep the existing desktop sidebar and add an accessible Add Dinner action there.
- Make the centre ＋ open the add/import sheet from either tab.
- Add the shared header with title and ••• settings trigger.
- Implement the small settings drawer with:
  - a browser-local keep-screen-awake switch, enabled by default;
  - a Settings button linking to the existing `/settings` page.

### URL-addressed Dinner sheets

- Make `/dinners/[dinnerId]` render the Cookbook beneath an open Dinner sheet.
- Closing the sheet or using browser Back returns to `/dinners`.
- Loading or refreshing the Dinner URL restores the same sheet.
- Keep picker, tag filter, plan, and action-menu layers as transient sheet state.
- Carry explicit origin/date context through edit and create routes only where needed to return to the correct Week or Cookbook sheet after Save.
- Editor Cancel closes the complete flow and returns to the bare originating tab; transient collection state may reset.

### Shared collection controls

Extract shared controls/helpers for Cookbook and the Week picker:

- live name/tag search;
- A–Z ordering;
- Haven't-had-lately ordering: never cooked first, then oldest cooking date, ties A–Z;
- Favourites ordering: favourites first, then all remaining Dinners; each group by Cooking Frequency descending, ties A–Z;
- AND tag matching;
- tag-filter draft/apply behavior;
- the eight most-used tags by active Dinner count, ties A–Z;
- active-filter chips, counts, and empty states;
- recency/current-week label formatting, including `over a year ago` after `52 wks ago`.

Use the ISO week number and the month/year of the week's Monday.

### Completion check

- The shell works at approximately 320–480px and remains usable on desktop.
- Dinner URLs survive refresh and browser navigation.
- Week and Cookbook consume the same ordering, filtering, and label helpers.
- The wake-lock preference survives browser reloads and fails silently when unsupported.

## Change set 3: Cookbook vertical slice

Implement the complete Cookbook journey on top of the shared summaries and shell.

### List

- Rebuild the compact mobile list with clipped one-line tags and overflow count.
- Search names and tags live.
- Apply the three agreed orderings.
- Show total Dinner count normally and matching count during search/tag filtering.
- Provide contextual empty states; keep new-Dinner creation in the global ＋.

### Dinner sheet

- Reuse the current Recipe rendering for multipart recipes, Source Link, ingredient notes, and mixed Recipe/notes content.
- Apply the new adaptive, view-only sheet presentation, history line, footer actions, and long-recipe sticky/jump behavior.
- Notes-only Dinners show their note without empty Recipe prompts or a Notes heading.
- Acquire wake lock while open unless disabled locally.

### Dinner menu and deletion

- Add/remove the Household-shared favourite.
- Hide Merge.
- Keep hard deletion and its confirmation.
- Explicitly warn that the Dinner and its Cooking History will be lost.
- Show all affected past and future Plan Slot dates in a bounded scrolling list.

### Plan this Dinner

- Stack the compact week/day sheet over the Dinner sheet.
- Allow navigating and correcting past weeks.
- Free days plan immediately.
- Taken days expand inline with Keep/Replace.
- Both successful plan and replace actions close the sheets and show a simple full-date toast such as `Spaghetti Carbonara → Wednesday, August 13th`.
- Do not implement Undo.

### Completion check

- Direct Dinner URLs, favourite ordering, planning, replacement, deletion, and notes-only rendering match the handoff.
- The recently implemented Recipe capabilities remain intact.

## Change set 4: Week vertical slice

### Week home

- Rebuild the Monday–Sunday mobile rows and today/empty/planned states.
- Preserve previous/current/next week behavior and prefetching.
- Render the floating week selector without overlapping the raised global ＋.

### Picker and filters

- Open the whole Cookbook immediately for an empty Plan Slot.
- Reuse shared search, ordering, tag-filter, count, and empty-state components.
- Exclude the current Dinner when replacing.
- `Surprise me!` immediately plans a random Dinner from the current matching set.
- `New dinner` opens the add flow with the Plan Slot date attached.

### Planned-day sheet

- Reuse the adaptive Dinner/cook view.
- Put Change, Edit, and Clear behind the anchored menu.
- Keep Clear immediate with no confirmation or toast.
- Allow past Plan Slots to be corrected.
- Edit Save returns to the same planned-day sheet.
- Week-originated plan/change/clear actions update the visible row without confirmation toasts.

### Completion check

- Planning, replacing, clearing, Surprise me, past-date correction, and edit return work through the new sheet stack.
- A Dinner created from an empty date is saved, planned for that date, and reopened in the planned-day sheet.

## Change set 5: Add/import state machine and editor chrome

Refactor the current CreateDinner/import UI around the working acquisition and AI extraction code rather than rewriting that backend.

### Add a Dinner

- Open the name-first sheet from the global ＋ or a date-attached Week flow.
- Quick-add creates a name-only Dinner.
- Global quick-add navigates to its URL-addressed Cookbook sheet.
- Date-attached quick-add plans it and returns to its Week planned-day sheet.
- Write it myself opens the ordinary editor, preserving a typed name.

### Source screens

- Add dedicated Link, YouTube, Photos, and Text screens within the sheet flow.
- Let Link and YouTube accept either URL type and select acquisition from the parsed URL.
- Defer YouTube metadata preview.
- Use best-effort clipboard URL prefill on both URL screens.
- Preserve the current photo compression/order pipeline, four-photo limit, native chooser, and capture input.
- Make the empty placeholder tappable; make the picked-photo ＋ tile open the library/file chooser.
- Disable Import until input is valid and keep recoverable errors inline without discarding input.

### Loading and errors

- Replace inline loading with the blocking full-page presentation.
- Keep phase progression presentational unless truthful milestones are easy to expose.
- Abort the client request and propagate cancellation through acquisition/model APIs where supported; return to the source with input intact.
- Keep typed error codes and supply the agreed short error-page copy.
- New-Dinner error: Try again / Write it myself / Back.
- Existing-Dinner error: Try again / Write it myself (return to unchanged editor) / Back.

### Editor and conflicts

- Remove the import-review banner.
- Move Save to the fixed footer and use Cancel/title/••• in the top bar.
- Preserve current multipart Recipe editing and Household import instructions.
- Implement non-blocking name conflict choice using normalized whitespace/case comparison.
- Implement the parallel Source Link conflict choice using normalized URLs.
- For an existing Dinner, imported content replaces servings and all Recipe parts while preserving notes and tags.
- Keep AI tag suggestions out of this change.
- Clear Recipe removes parts and servings while preserving name, tags, notes, and Source Link.
- Write it myself on an existing Dinner returns to the unchanged editor.
- Hide Merge; retain Import, conditional Clear Recipe, and Delete.

### Completion check

- No import persists before Save.
- Typed names, source input, photos, and existing editor data survive their agreed recovery paths.
- Name and Source Link choices work independently.
- Save and Cancel land at the correct Week/Cookbook destinations.

## Change set 6: Integration and visual QA

Do not create a broad testing project for this redesign. Add a focused automated test only when it materially simplifies risky ordering/date/aggregation work.

### Required verification

- Exercise the canonical states at approximately 390px width using the existing capture workflow.
- Smoke-check narrow (~320px), wide mobile (~480px), and desktop layouts for overflow and reachability.
- Exercise current iOS Safari and Android Chrome behavior where available; core flows must not depend on clipboard or wake-lock support.
- Verify the complete cross-feature journeys:
  - global quick-add → Cookbook Dinner sheet;
  - empty day → new/import → planned-day sheet;
  - Cookbook Dinner → plan free/taken date → full-date toast;
  - Dinner edit/import conflicts → Save/Cancel destinations;
  - favourite toggle → ordering update;
  - delete → explicit history warning → affected Plan Slots removed.
- Run `pnpm lint` and `pnpm typecheck`.
- Run `pnpm build` before release when environment credentials/services allow it.

## Release approach

The work may be implemented as the change sets above, but the redesigned mobile shell should be released coherently rather than exposing transitional navigation with mismatched destinations. The app's current family-only audience can tolerate temporary development friction, so do not add a feature-flag system solely for this redesign.
