# Handoff: Shared dinners — the household's public-share list (Plan Eat Repeat)

## Overview
Households can share individual dinners publicly (see `design_handoff_public_dinner`). This feature gives the household a view of everything they have shared, plus the doors into it. Four screens, shown in `Shared dinners.dc.html` and `screenshots/`.

A shared dinner remains a completely normal dinner: it is never filtered out of, badged in, or otherwise separated from the normal Cookbook list.

## Screens

### 1. Cookbook header (`01-cookbook-header.png`)
- A circular 36px button left of the ••• button: two-persons icon, same grey ink (`#57504a`) and border treatment as •••. **No count, no terracotta.**
- Visible only while the household has ≥1 publicly shared dinner. At zero it is absent and the header shows ••• alone.
- Tap → Shared dinners screen.

### 2. Settings drawer (`02-settings-drawer.png`)
- "Shared dinners" row between Household and Preferences. Plain label + chevron, no count, no icon — identical in weight to its neighbours.
- Always present (even at zero shared); this is the permanent, findable address.

### 3. Shared dinners list (`03-shared-dinners-list.png`)
- Back link "‹ Cookbook", Young Serif title "Shared dinners".
- Pinned public-page row directly under the title (never scrolls away): household name possessive + "public page", the household URL below in small type, terracotta "View" at right. No avatar. Whole row taps through to the public household page.
- Search field + funnel button, identical components to the Cookbook.
- Sort segmented control: **Recently shared (default) / A–Z / Most saved**.
- Rows: dinner name (Young Serif) + chevron; meta line "Shared {date} · saved by {n}". Omit "saved by" at zero. **No "opened N times".** No ••• button on rows.
- Tapping anywhere on a row opens the row sheet.

### 4. Row sheet (`04-row-sheet.png`)
- Meta line + dinner name header.
- Link box with the dinner's public URL and terracotta **Copy** (same component as the share drawer).
- Action list: Open public page / Open dinner / **Stop sharing** (destructive tint).
- Stop sharing confirms; people who already saved the dinner keep their copy.

## URLs
- Household public page: `planeatrepeat.com/h/<name-slug>-<id>` (e.g. `/h/hendersons-4b7q`) — same slug+id shape as dinner URLs, so household names need not be unique and renames keep old links working.
- Household names render verbatim everywhere; never prepend "the".

## Tokens
Follows the PlanEatRepeat design system: Quicksand UI text, Young Serif for dinner names and titles, terracotta `#C2552F`/`#DD6B42` for actions, warm stone `#FAF8F5` page, card fill `#F7F4EE`, borders `#e6e0d4`/`#ddd6c8`, 12px card radius.

## Out of scope here
The public household page itself (the outside view reached via "View" and from dinner-page attribution) is a separate piece — see turn 1d in `Shared lists.dc.html` at the project root for its current direction; not yet finalized.
