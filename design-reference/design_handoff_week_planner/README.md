# Handoff: Week Planner (Plan Eat Repeat)

## Overview
The Week tab is the home screen of Plan Eat Repeat, a dinner-planning app. One dinner slot per day, Monday–Sunday. This handoff covers the full Week-tab experience: the week list, the empty-day dinner picker, tag filtering, and the planned-day viewing sheet with its actions menu.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (the existing Plan Eat Repeat app) using its established patterns and component library. `Product Directions.dc.html` contains the canonical screens only. `screens/` holds 2x screenshots of each canonical screen. Earlier explorations and rejected directions remain archived in Claude Design.

When sources disagree, this README is authoritative, followed by the canonical screenshots/HTML, current application behavior, and then old issues.

## Fidelity
**High-fidelity.** Colors, type, spacing, and copy are final intent. Implement with the existing PlanEatRepeat design system (`@planeatrepeat/web`) — semantic tokens (`bg-background`, `bg-primary`, `bg-muted`, `border-border`, etc.), Quicksand for UI text, Young Serif for dinner names and page headings, `rounded-lg` (0.75rem) brand radius. Where this doc gives raw hex values, they exist only because the prototype couldn't use the token names — always prefer the semantic token that matches.

The canonical screens target mobile browsers at approximately 390px wide. Support roughly 320–480px without overflow. Desktop must remain functional using the existing sidebar and responsive-dialog patterns, but desktop visual redesign is deferred. The unfinished Expo app is out of scope.

## Core model decisions (agreed)
- A dinner is one slot per day. Takeaway and leftovers are ordinary dinners without recipes — no separate concepts.
- Tapping a day (empty or planned) opens a bottom sheet. There is ONE adaptive planned-day sheet: it shows the full recipe inline and IS the cook view.
- The planned-day sheet is **view-only**. All mutations live behind its ••• menu.
- Editing a dinner always happens in the single edit view owned by the Cookbook; the Week tab deep-links to it and returns on save. No "Add recipe" prompts in the viewing sheet.
- Keep-screen-awake while the planned-day sheet is open is automatic and invisible; one opt-out switch lives in Preferences (behind the header ••• drawer). No indicator in the sheet.
- Tag filtering matches ALL selected tags (AND), silently — no UI copy about it.
- A past plan is presumed to represent a dinner that was cooked. Today and future plans do not contribute to cooking recency or frequency. Planning, changing, or clearing a past date corrects that history.
- Cookbook Dinner sheets are URL-addressable. Browser Back closes the sheet, and loading a Dinner URL directly restores the Cookbook with that dinner open.

## Screens / Views

### 1. Week home (`screens/01-week-home.png`)
- **Header**: page title "Week" (Young Serif, ~30px, warm gray `#a39a8e`-ish muted tone in mock; use the app's heading style), and a circular ••• button top-right (36px circle, 1px border `border-border`). It opens a small settings drawer containing the browser-local keep-screen-awake switch and a **Settings** button linking to the existing Settings page.
- **Day list**: 7 rows, vertical stack, ~10px gap.
  - **Planned day card**: filled card `bg-muted`-like warm fill (`#F1EDE6`), `rounded-lg` (14px in mock), padding 12px 16px. Contents: date label (11px, 700, muted `#a39a8e`, e.g. "Mon 27th") above dinner name (Young Serif, 20px, `#221d1a`).
  - **Today's card**: same layout; white background, 1.5px `primary` border (`#DD6B42`), date label reads "Sat 1st · Tonight" in primary (`#C2552F`).
  - **Empty day**: transparent background, **1.5px dashed border** `#d4ccbc`, same radius/padding; single row: date label left, bare **＋** right-aligned (19px, weight 300, muted `#a39a8e`). **No circle around the ＋.** Whole row is the tap target.
- **Week selector pill**: floating pill centered above the tab bar (white, full radius, shadow `0 2px 10px rgba(60,50,40,.14)`, 6px padding). Contents left→right: ◂ button, calendar/today button, ▸ button (34px circles, 1px border `#e2dbcc`), then label "Week 31, July, 2026" (13px, 600). Keep ~22px clearance above the tab bar so the raised ＋ never overlaps it.
- **Tab bar**: top border `border-border`, background `bg-background` (`#FAF8F5`). Three equal columns: **Week** · **＋** · **Cookbook**. Labels are text-only (no icons), 15px, 700, vertically centered; active tab in primary text (`#C2552F`), inactive muted (`#a39a8e`). The **＋ button** is a 52px primary circle (`#DD6B42`, white ＋ 26px, shadow) raised so roughly half of it pops above the bar's top edge. ＋ opens the add/import sheet from any tab.

### 2. Empty day → picker sheet (`screens/02-empty-day-picker.png`)
Bottom sheet (~90% height, 20px top radius, drag handle, shadow) over the dimmed Week screen.
- **Header line**: centered, 13px, 600, muted: "Tuesday, July 28th · nothing planned".
- **Search row**: search input ("Search the cookbook…", 44px, `border-input`, full radius) + a square **funnel button** (44px, `rounded-lg`, 1px border, funnel icon) on the right.
- **Sort segmented control**: `bg-muted` track (10px radius, 3px padding), three equal segments: **Haven't had lately** (default) · **A–Z** · **Favourites**. Active segment: white pill, primary text, subtle shadow; 11px, 700. "Favourites" is an ordering, not a filter: explicitly favourited dinners come first, followed by all remaining dinners; each group is ordered by cooking frequency descending, then A–Z.
- **The list**: the ENTIRE cookbook, immediately scrollable — no filter or search needed to start browsing. Row: warm fill `#F7F4EE`, 12px radius, 12px 14px padding, dinner name left (Young Serif, 15px), recency right (11px, 600, muted). "Haven't had lately" puts never-cooked dinners first, then least recently cooked, with A–Z as the tie-breaker. No badges of any kind. Tapping a row plans it for the day and closes the sheet. When replacing, omit the dinner already assigned to the day.
- **Footer**: two equal outline buttons pinned at the bottom: **New dinner** and **Surprise me!** (white, 1px border, 12px radius, 13px 700).
- Rationale to preserve: the sheet must open already showing dinners — browsing is the primary act; search and tags are accelerators.

### 3. Funnel → tag sheet (`screens/03-tag-filter-sheet.png`)
Opens over/instead of the picker (same sheet swap or a second sheet). No heading.
- **Tag search input** ("Search tags…") at top.
- **Selected** section (only when ≥1 tag selected): selected tags as filled chips (`#F6DDD2` fill, primary border, primary text, "Name ✕"), followed by a **tag-shaped "Clear all" chip** (dashed border, muted text) at the end of the row.
- **Most used** section: the Household's eight most-used tags as outline chips, each with a small count ("Asian 14"). Usage is the number of active Cookbook dinners carrying the tag; ties are A–Z. Tags already under Selected do not repeat here or under All tags.
- **All tags** section: every remaining tag alphabetically, same chip style, wrapping.
- Chips: full-radius, 6px 12px padding, 12px 600 text; selected state = filled as above. Tapping toggles.
- **Primary button pinned at bottom**: filled primary, full width: "Show 9 dinners" (live count of dinners matching ALL selected tags). Returns to the picker and commits the draft selection. Dismissing the tag sheet by swipe, Back, or scrim discards its changes.

### 4. Picker, filtered (`screens/04-picker-filtered.png`)
Same picker sheet with a filter active:
- Funnel button becomes **tinted**: primary border, `#F6DDD2` fill, primary icon. (No count in the button.)
- A removable chip row of the active tags ("Quick ✕" "Vegetarian ✕", filled chip style) appears between search and the sort control — only while a filter is on.
- List shows only matching dinners; end-of-list caption "9 dinners match" (11px, muted, centered).
- Sort control and footer buttons unchanged.

### 5. Planned day → viewing sheet (`screens/05-planned-day-sheet.png`)
Tapping a planned day opens the same-shaped bottom sheet. **This is the cook view.** View-only.
- **Header row**: date left-aligned (13px, 600, muted, "Wednesday, July 29th, 2026"), circular **••• button** right (30px, 1px border).
- **Dinner name**: Young Serif, ~26px.
- **Tag chips** (read-only outline chips), then "4 servings" (12px, 600, muted).
- **Ingredients**: rows of `quantity` (bold, fixed-width column, e.g. "400 g") + name + optional preparation note in italic muted ("— diced").
- **Steps**: numbered (number in a small muted circle or bold), 14px body, comfortable line height.
- Whole sheet scrolls. For long recipes keep the previously-agreed pinned dinner name + Ingredients/Steps jump bar once the name scrolls off. A notes-only dinner (e.g. "Takeaway") just shows its notes — **no "Add recipe" prompt**.
- **Keep-screen-awake activates automatically** while this sheet is open (wake lock); released on close. No UI here.

### 6. ••• menu on the planned day (`screens/06-planned-day-menu.png`)
Anchored dropdown from the ••• button (230px, white, `border-border`, 14px radius, shadow `0 8px 28px rgba(60,50,40,.22)`). **No dimming/muting of the sheet content beneath** — the menu floats on its shadow alone. Three rows (13.5px, 600, 11px 14px padding, hairline separators), in frequency order:
1. **⇄ Change dinner** — keeps the day held, drops straight into the picker sheet (screen 2); picking replaces the dinner. The current dinner is omitted from replacement results.
2. **✎ Edit this dinner** — deep-links to the Cookbook's edit view for this dinner; returns here on save.
3. **✕ Clear Wednesday** — destructive tint (`#a34524` / `text-destructive`-adjacent), empties the day back to a dashed empty row.

## Interactions & Behavior
- Day rows: whole row tappable. Empty → picker sheet; planned → viewing sheet.
- Week ◂ ▸ navigate weeks; calendar button jumps back to the current week.
- Sheets: standard bottom-sheet behavior (drag handle, swipe-down or scrim tap to dismiss).
- Picker: search filters live; sort control re-orders; funnel opens tag sheet; row tap plans and dismisses; "Surprise me!" immediately plans a random dinner from the current search/tag result set; "New dinner" opens the create flow with the day pre-attached.
- Tag filter: AND semantics. The tag sheet edits a draft and "Show N dinners" commits it. Chip ✕ and "Clear all" in the picker update the active filter immediately.
- Change dinner: opens picker with day context ("Wednesday · replacing Spaghetti Carbonara" context is optional; day must stay held).
- Wake lock: acquire on planned-day sheet open, release on close/background; a browser-local setting in the header drawer disables it. Lack of browser support or permission is silent.
- Past dates remain editable and are treated as corrections to Cooking History.
- Planning, changing, and clearing from Week update the visible row without a confirmation toast. Clear is immediate and does not ask for confirmation.
- Saving a new dinner from a day-attached flow plans it for that date and returns to Week with its planned-day sheet open. Cancelling closes the sheet stack and returns to the bare Week tab; transient search and filter state may reset.
- Empty/no-match states use short contextual copy. A zero-match tag selection can still be committed, after which the picker offers a clear-filter action.

## State Management
- `currentWeek` (ISO week), `plans: {date → dinnerId}`.
- Picker: `searchQuery`, `sort: 'not-lately' | 'az' | 'favourites'`, `selectedTags: string[]` (AND-matched), derived `matchCount`.
- Sheet stack: week → (picker | viewing) → tag sheet / ••• menu.
- Dinner: name, tags, servings, multipart recipe content, notes, Source Link, Household-shared favourite flag, lastCookedDate, and cookingFrequency. Past Plan Slots drive cooking history; today and future plans do not.

## Recency and week labels
- `tonight` when planned today.
- Otherwise the nearest upcoming weekday when planned later in the current week.
- Otherwise the most recent weekday when cooked earlier in the current week.
- Otherwise `this week`, `1 wk ago`, or `N wks ago` from the most recent past Plan Slot.
- Use `over a year ago` after `52 wks ago`.
- Use `never made` when there is no past Plan Slot.
- If a dinner appears more than once in the current week, today wins, then the nearest upcoming day, then the most recent past day.
- Week labels use the ISO week number and the month/year of that week's Monday.

## Design Tokens (as rendered in the prototype)
Use the design-system semantic tokens; hex values below are what the prototype renders.
- Background `#FAF8F5` (bg-background) · card fill `#F1EDE6` / list-row fill `#F7F4EE` (muted/secondary) · white surfaces `#fff`
- Primary terracotta `#DD6B42`, pressed/text primary `#C2552F`, primary tint fill `#F6DDD2`, destructive-ish `#a34524`
- Text `#221d1a` (headings), `#332e29` (body), `#8a8276` / `#a39a8e` (muted), borders `#e6e0d4` / `#e2dbcc`, dashed empty-day border `#d4ccbc`
- Type: Quicksand (UI, 11–15px range as noted), Young Serif (dinner names 15–26px, page title ~30px)
- Radius: cards 12–14px (`rounded-lg`), pills/chips/buttons full-radius where noted
- Shadows: pill `0 2px 10px rgba(60,50,40,.14)`, menu `0 8px 28px rgba(60,50,40,.22)`, sheet `0 -6px 24px rgba(60,50,40,.18)`

## Assets
No image assets. Icons in the prototype are inline 24×24 stroke SVGs (chevrons, calendar, funnel, book) at stroke-width 2–2.2 — use the app's existing icon set (lucide-style).

## Files
- `Product Directions.dc.html` — canonical Week Planner screens only.
- `screens/01-week-home.png` … `06-planned-day-menu.png` — 2x screenshots of the six canonical screens.

## Out of scope (designed later)
The full Settings redesign, desktop visual redesign, Expo parity, AI tag suggestions, YouTube metadata preview, and database hardening for date-only Plan Slots and a unique Household/date constraint. The minimal settings drawer, Cookbook, add/import sheet, and editor integration are part of the coherent mobile-web redesign.
