# Handoff: Public dinner list — a household's shared dinners (Plan Eat Repeat)

## Overview
Every public dinner page attributes its dinner to a household ("Shared by the Hendersons"). That household name is now a **link**, and this is the page behind it: a public web page listing **all** the dinners that household has shared, at `planeatrepeat.com/h/<name-slug>-<id>`. Like the dinner page it is public, indexable, works signed out, and carries one CTA.

Covers: the public household list page (desktop and phone), the **change to the public dinner page** that links to it, and the in-app **Shared dinners** list whose pinned row points at it. Not covered: the rest of the household view inside the app (see `design_handoff_shared_lists/`), and any following/profile concept — there is none.

## About the Design Files
`Public dinner list.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code to copy directly. Recreate it in the existing Plan Eat Repeat app using its established patterns and component library. `screens/` holds 2x screenshots of both canonical screens. The full design-review canvas with the rejected explorations stays in the project as `Public dinner list.dc.html` at the root.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy are final intent. Implement with the PlanEatRepeat design system (`@planeatrepeat/web`) — semantic tokens (`bg-background`, `bg-card`, `bg-primary`, `bg-muted`, `border-border`), Quicksand for UI text, Young Serif for dinner names and page headings, `rounded-lg` (0.75rem) brand radius. Hex values below are what the prototype renders; always prefer the matching semantic token.

## Relationship to existing surfaces
Read `design_handoff_public_dinner/README.md` first — this page shares its chrome (wordmark left, primary CTA right, warm off-white, footer upsell) and is one hop from it in both directions. The list body follows `design_handoff_shared_lists/` : the same search field, funnel button and three-way sort a member sees in the app, so a visitor is looking at the product before they have it.

## Data model notes
- **Slug:** `planeatrepeat.com/h/<name-slug>-<id>`, stable, derived from the household display name. Households already need a display name for dinner-page attribution; the same value drives this.
- The page lists **only dinners that are individually shared**. Sharing a dinner adds it here; stopping the share removes it. There is no separate "share my cookbook" switch, and no way to be listed without having shared something.
- Served **live** — later edits to a dinner appear here, same as on the dinner page.
- **Never public:** cook history, planned days, favourite state, members, and any dinner that is not shared.
- **saved by N** comes from copies carrying `source_dinner_id` (see the public-dinner handoff). Omit the line entirely at zero rather than showing "saved by 0".
- If the household has stopped sharing everything, the URL 404s rather than showing an empty page.

## Screens / Views

### 1. Household list — desktop (`screens/01-household-list-desktop.png`)
Warm off-white page `#FAF8F5`, single centred column, same measure as the dinner page.

- **Top bar:** wordmark "Plan Eat Repeat" (Young Serif, primary) **left**; **Start my cookbook** filled primary right; 1px bottom border. The CTA is *Start my cookbook*, not *Add to my cookbook* — there is no single dinner to add here.
- **Header:** 44px circular avatar (`#F6DDD2` fill, primary initial) + **"Hendersons"** (Young Serif 30px) with **"12 dinners shared"** beneath (11.5px, 700, muted). No join date, no member list, no other stats.
- Hairline.
- **Search row:** full-width search field ("Search their dinners…") + 42px funnel button, 10px gap. Same pair as the in-app cookbook list.
- **Sort segment:** `#F1EDE6` track, 4px padding, **full column width with the three options each taking a third** — Recently shared (default) · A–Z · Most saved. Active pill is white with a soft shadow, label in primary. The full width matters: a narrow segment between two full-width bands reads as a mistake.
- **Grid:** three columns, 10px gap. Each card is white, 1px `border-border`, 12px radius, min-height 86px: dinner name in Young Serif 16px, tag chips beneath, and **saved by N** pinned to the card floor (10.5px, muted) when non-zero.
- **"⌄ 6 more ⌄"** centred below the grid — paginate or lazy-load, implementation's choice.
- **Footer band** `#F7F4EE`: "All your recipes in one place." (Young Serif 15px) over "Plan Eat Repeat is a free cookbook and dinner planner." (12.5px muted), with **Start my cookbook** repeated at the right.

Tapping a card opens that dinner's public page. Tapping the household name there returns here.

### 2. Household list — phone (`screens/02-household-list-phone.png`)
Same content, stacked as three cards on the `#F2EFE8` page.

- Wordmark **left aligned** at the top of the page (13px Young Serif, primary) — not centred.
- **Card 1 — header + controls:** avatar 38px + name (Young Serif 21px) + "12 dinners shared"; search field + funnel (38px); the three-way segment at its natural size across the card.
- **Card 2 — the dinners:** rows, not cards. Dinner name Young Serif 16px with **saved by N** right-aligned on the same line, tag chips beneath, hairline `#f0ebe0` between rows, none after the last. Rows are ~44px+ tall including chips.
- **Card 3 — upsell:** "Never wonder what's for dinner." (Young Serif 16px), the one-line description, and **Start my cookbook** as a 44px full-width primary button. The CTA is **not** pinned to the viewport — the visitor scrolls to it, same decision as the dinner page.

### 3. Public dinner page — desktop, updated (`screens/03-public-dinner-desktop.png`)
Unchanged from `design_handoff_public_dinner/` except the attribution line, which is now the entry point to this page:

- Reads **"Shared by Hendersons · 12 August"** — the household display name only, no leading "the".
- **The name is a link** to `/h/<slug>`: primary `#C2552F`, 700, underlined with a lighter primary underline (`#e7b9a4`, 2px offset). The rest of the line stays 12px/600 muted.
- Everything else — avatar, date, H1, chips, two-column recipe, footer band — is untouched.

### 4. Public dinner page — phone, updated (`screens/04-public-dinner-phone.png`)
Same single change: **"Hendersons shared a dinner with you"**, with **Hendersons** as the link in the same treatment. Nothing else on the card moves.

### 5. Shared dinners, inside the app (`screens/05-shared-dinners-in-app.png`)
The member-facing list from `design_handoff_shared_lists/`, shown here for the link at the top. The pinned row now reads **"Hendersons public page"** (not "Hendersons' public page") over the URL, with **View** in primary at the right end. View opens screen 1 in a browser. The row is hidden while the household has zero shared dinners.

## Copy (verbatim)
- Search placeholder: **Search their dinners…**
- Sorts: **Recently shared** · **A–Z** · **Most saved**
- Meta: **12 dinners shared** / **saved by 4**
- CTA: **Start my cookbook**
- Desktop footer: **All your recipes in one place.** / *Plan Eat Repeat is a free cookbook and dinner planner.*
- Phone upsell: **Never wonder what's for dinner.** / *Plan Eat Repeat is a free cookbook and dinner planner.*
- Dinner page attribution: **Shared by Hendersons · 12 August** (desktop) / **Hendersons shared a dinner with you** (phone)
- In-app pinned row: **Hendersons public page**

## Open questions
- **Sort default.** "Recently shared" assumes visitors come back for what's new. If most traffic is one-time arrivals from a single dinner link, "Most saved" is the better first impression.
- **Search and sort at small counts.** At three or four shared dinners the control row outweighs the content. Suggest hiding search + funnel below ~8 dinners and the sort segment below ~5.
- **Tag filtering.** The funnel opens the same tag sheet as the app, filtered to tags present in the shared set. Confirm this is worth building for v1 or drop the funnel until search proves used.
