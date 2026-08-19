# Handoff: Cookbook (Plan Eat Repeat)

## Overview
The Cookbook is the second tab of Plan Eat Repeat. It is the list of every dinner the household cooks — where you go to decide what to make when nothing is planned, and where dinners are managed. This handoff covers the **main list** and the **dinner view**, including planning a dinner onto a day from inside the Cookbook. Creation, editing, and importing integrate with the separate AI/import handoff and the existing Recipe UI. Merge is deferred and hidden.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Recreate these designs in the existing Plan Eat Repeat app using its established patterns and component library. `Canvas-3.dc.html` is the full design-review document; the canonical screens are the section labeled **11 / 11a** at the top. `screens/` holds 2x screenshots of each canonical screen.

When sources disagree, this README is authoritative, followed by the canonical screenshots/HTML, current application behavior, and then old issues.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final intent. Implement with the PlanEatRepeat design system (`@planeatrepeat/web`) — semantic tokens (`bg-background`, `bg-primary`, `bg-muted`, `border-border`), Quicksand for UI text, Young Serif for dinner names and page headings, `rounded-lg` (0.75rem) brand radius. Hex values below are what the prototype renders; always prefer the matching semantic token.

The canonical screens target mobile browsers at approximately 390px wide. Support roughly 320–480px without overflow. Desktop must remain functional with the existing sidebar and responsive-dialog patterns; desktop visual redesign and Expo parity are deferred.

## Relationship to the Week tab
The Cookbook deliberately reuses the Week planner's vocabulary. Read `design_handoff_week_planner/README.md` first — search + funnel row, the three sorts, the "x wks ago" right column, warm row fills, the bottom-sheet shape, the ••• menu style and the tag-filter sheet are all **the same components**, not lookalikes.

## Screens / Views

### 1. Cookbook list (`screens/01-cookbook-list.png`)
- **Header**: page title "Cookbook" (Young Serif, ~30px) and the circular ••• settings button top-right (36px, 1px `border-border`) — same header as Week.
- **Search row**: search input ("Search dinners…", 44px, `border-input`, full radius) + square 44px **funnel button** (`rounded-lg`, 1px border). Identical to the picker's row; opens the same tag-filter sheet.
- **Sort segmented control**: `bg-muted` track, three segments — **A–Z (default here)** · **Haven't had lately** · **Favourites**. Note the default differs from the day picker, where "Haven't had lately" leads. "Favourites" is an ordering, not a filter: explicitly favourited dinners come first, followed by all remaining dinners; each group is ordered by past cooking frequency descending, then A–Z.
- **Dinner rows** (cards): warm fill `#F7F4EE`, 12px radius, 12px 14px padding, ~10px gap.
  - Top line: dinner name left (Young Serif, 15px), **"x wks ago"** right (11px, 600, muted `#a39a8e`). A dinner planned in the current week shows **"tonight"** / the day instead, in primary `#C2552F`.
  - Second line (only when the dinner has tags): a **single non-wrapping row of tag chips**, clipped to the card width, with a quiet **"+5"** overflow marker in muted text at the end. Chips: white fill, 1px `#e6e0d4`, full radius, 3px 9px, 10.5px 600, muted text.
  - **Dinners with no tags lose the second line entirely** and the card shrinks to one line. This is intended — the list should have rhythm, not forced uniform height.
  - A dinner with 8 tags must never be taller than one with 3. Truncate, never wrap.
- **Filtered results**: caption "9 dinners match" (11px, muted, centered) while search or tag filtering is active. Favourites changes ordering, not membership, so it does not show a count by itself.
- **No "Surprise me!" and no "New dinner" button in the Cookbook.** New dinners come from the ＋ tab; Surprise me! belongs to the day picker, where a random pick is actionable.
- Tab bar identical to Week, with **Cookbook** active.

### 2. Dinner sheet (`screens/02-dinner-sheet.png`)
Tapping any row opens a bottom sheet over the dimmed Cookbook. **This is the same adaptive, view-only sheet as the planned-day sheet in the Week tab** — same type, order and cook-view behavior. It sizes itself to its content.
- **Header block**, left side, two lines tight together:
  1. **"Last cooked 3 wks ago · 14 times"** (11.5px, 600, muted `#8a8276`) — sits ABOVE the name, small and quiet.
  2. Dinner name (Young Serif, ~22–26px), ~1px below it.
  A circular **••• button** (30px, 1px border) sits at the right, **vertically centered on the two-line block**.
- **Tag chips** (read-only, same chip style as the list, wrapping allowed here), then "4 servings" (12px, 600, muted).
- Preserve the current quiet Source Link treatment and the existing rendering of named multipart recipes, ingredient preparation notes, and mixed recipe-plus-notes dinners. The canonical screens simplify these existing states; they do not remove them.
- **Ingredients**: `quantity` in a bold fixed-width column ("400 g") + name + optional italic muted preparation note ("— diced").
- **Steps**: numbered, 14px body, comfortable line height.
- Sheet scrolls; long recipes keep the agreed pinned-name + Ingredients/Steps jump bar behavior from the Week sheet.
- **Footer**: two buttons on the sheet floor, no bar, no fill behind them, equal width: **Plan this dinner** and **Edit** — **both white outline buttons**. Neither is primary: the usual reason for being here is to read. `Edit` deep-links to the Cookbook-owned edit view and returns on save.
- Keep-screen-awake applies here exactly as in the Week sheet: automatic, invisible, released on close.

### 3. ••• menu on a dinner (`screens/03-dinner-menu.png`)
Anchored dropdown from the ••• button (210px, white, `border-border`, 14px radius, shadow `0 8px 28px rgba(60,50,40,.22)`), opening **below the button so the name and history line stay visible**. **No dimming of the content beneath.** Rows are plain words — **no icons** — 13.5px, 600, 11px 14px padding, hairline separators:
1. **Add to favourites** (toggles to "Remove from favourites"; drives the Favourites ordering)
2. **Delete dinner** — destructive tint (`#a34524`), asks for confirmation. Deleting permanently removes the dinner and every past and future Plan Slot that uses it. The confirmation explicitly warns that Cooking History will be lost and lists all affected dates in a bounded scrolling list. **Merge is hidden until implemented.**

### 4. Plan this dinner (`screens/04-plan-sheet.png`)
**Plan this dinner** opens a second, short sheet stacked over the dinner sheet. The user is never thrown back to the Week tab.
- The sheet **hugs its content** — exactly as tall as the header plus seven days, no dead space.
- **Title**: "Plan **Spaghetti Carbonara** for…" (13px, 600; the dinner name inside it in Young Serif).
- **Week stepper**: ◂ / ▸ 28px circle buttons around the label **"Week 31, July"** (12px, 600) — same wording style as the Week tab's pill. Steps to any week, forward or back.
- **Seven day rows**, 12px radius, 10px 14px padding, ~6px gap:
  - **Taken day**: white fill, 1px `#e2dbcc`; date label left in a fixed ~62px column (12px, 700), the dinner it holds beside it (Young Serif, 14px, muted).
  - **Free day**: transparent, **1.5px dashed `#d4ccbc`**, label "free" (12px, 600, muted) — the same empty-day language as the Week list.
  - **Today**: 1px primary border, date label in primary reading "Sat 1st · Tonight".
- **Tapping a free day plans immediately**: both sheets close and a simple toast confirms without Undo ("Spaghetti Carbonara → Wednesday, August 13th").

### 5. Plan sheet, taken day tapped (`screens/05-plan-sheet-taken-day.png`)
No dialog. The tapped row **expands in place**: primary border, `#F6DDD2` fill, and the label line becomes "Thu 30th — **already has Eggplant Parmesan**" (12px, 600, `#a34524`), with two equal buttons beneath it inside the row: **Keep it** (white outline) and **Replace** (filled primary). Keep it collapses the row; Replace plans and closes both sheets with the same full-date confirmation toast and no Undo.

### 6. Dinner with only notes (`screens/06-notes-only-dinner.png`)
Takeaway, leftovers and notes-only dinners are ordinary dinners. Same sheet, same header treatment (**"Last cooked 2 wks ago · 9 times"** above the name — use this wording for every dinner type), the note rendered as plain body text (13.5px, line-height 1.6, `#332e29`), and the same two footer buttons. **No "Notes" heading, no empty Ingredients/Steps sections, no "Add recipe" prompt.** Adding a recipe happens through Edit.

## Interactions & Behavior
- Row tap → dinner sheet. Dinner sheets are URL-addressable: `/dinners/[dinnerId]` restores the Cookbook with that dinner open, and closing or browser Back returns to `/dinners`. Other sheets use standard behavior (drag handle, swipe-down or scrim tap to dismiss). Dismissing the plan sheet returns to the dinner sheet underneath.
- Search filters live across dinner names and tags; the sort control re-orders; the funnel opens the **same tag-filter sheet as the Week picker** (AND semantics, silent, count only in the "Show N dinners" button).
- When a filter is active: the funnel button becomes tinted (primary border, `#F6DDD2` fill), and a removable chip row of the active tags appears between the search row and the sort control — same as the picker.
- The tag sheet edits a draft. "Show N dinners" commits it; swipe, Back, or scrim dismissal discards it. "Most used" is the eight tags attached to the most active Cookbook dinners, ties A–Z.
- Favourites ordering shows every matching dinner: favourites first, then all remaining dinners, with each group ordered by past Cooking Frequency descending and then A–Z.
- Cooking recency and frequency use past Plan Slots only. Today and future plans do not count. Follow the complete display priority and `over a year ago` threshold in the Week handoff.
- Planning onto a past date remains allowed and corrects Cooking History.
- Empty/no-match states use short contextual copy and offer to clear search/filters where applicable. A truly empty Cookbook points to the global ＋ rather than adding another permanent New Dinner button.
- Saving a globally-created dinner opens its URL-addressed Cookbook sheet. Saving an edit returns to the originating Dinner or planned-day sheet. Cancelling an editor closes the sheet stack and returns to the bare Week or Cookbook tab; transient search/filter state may reset.

## State Management
- List: `searchQuery`, `sort: 'az' | 'not-lately' | 'favourites'` (default `'az'`), `selectedTags: string[]` (AND-matched), derived `matchCount`.
- Sheet stack: cookbook → dinner sheet → (plan sheet | ••• menu | tag sheet).
- Plan sheet: `targetWeek` (ISO week, defaults to current), `plans: {date → dinnerId}`, pending-replace day.
- Dinner: name, tags, servings, multipart recipe content, notes, Source Link, Household-shared favourite flag, lastCookedDate, and cookingFrequency (drives "Last cooked … · N times").

## Design Tokens (as rendered in the prototype)
- Background `#FAF8F5` · list-row fill `#F7F4EE` · planned-card fill `#F1EDE6` · white surfaces `#fff`
- Primary terracotta `#DD6B42`, primary text `#C2552F`, primary tint fill `#F6DDD2`, destructive `#a34524`
- Text `#221d1a` (headings), `#332e29` (body), `#8a8276` / `#a39a8e` (muted), borders `#e6e0d4` / `#e2dbcc`, dashed `#d4ccbc`
- Type: Quicksand (UI, 10.5–15px as noted), Young Serif (dinner names 14–26px, page title ~30px)
- Radius: cards/rows 12px, menu 14px, sheet top 20px, chips/pills full radius
- Shadows: menu `0 8px 28px rgba(60,50,40,.22)`, sheet `0 -6px 24px rgba(60,50,40,.18)`

## Assets
No image assets. Icons are inline 24×24 stroke SVGs (funnel, chevrons) at stroke-width 2–2.2 — use the app's existing lucide-style icon set.

## Files
- `Canvas-3.dc.html` — the generated design-review document; its `t11` section contains the six canonical Cookbook states.
- `screens/01-cookbook-list.png` … `06-notes-only-dinner.png` — 2x screenshots of the six canonical screens.

## Out of scope (designed later)
**Merge** remains hidden until designed and implemented. The full Settings redesign, desktop visual redesign, Expo parity, AI tag suggestions, YouTube metadata preview, and database hardening for date-only Plan Slots and a unique Household/date constraint are deferred. The minimal settings drawer, dinner editor integration, and ＋ add/import flow belong to the coherent mobile-web redesign.
