# Handoff: AI import spend dashboard (Dashboard v2)

## Overview
An internal admin dashboard for Plan Eat Repeat that tracks the cost of AI recipe
imports. It reports **two independent currencies side by side**:

1. **Model inference** in USD (estimated).
2. **Supadata credits**, used for scraping some import sources.

Credits are never converted to USD. The Supadata API does not expose remaining
allowance, so only **spend** is shown — no quota, budget, or "remaining" figures
anywhere in the design.

## About the design files
The files in this bundle are **design references created in HTML** — a prototype
showing intended look and behaviour, not production code to copy. The task is to
recreate this design inside the target codebase's existing environment (React,
Vue, native, etc.) using its established patterns and component library. If no
environment exists yet, pick the most appropriate framework and implement there.

All numbers in the prototype come from a seeded synthetic generator so the charts
look plausible. Replace with real telemetry.

## Fidelity
**High fidelity.** Colours, type, spacing and interaction states are final and
should be matched. Built on the **PlanEatRepeat design system** (terracotta
primary on Warm Stone off-white, Quicksand body / Young Serif display,
0.75rem base radius). Prefer the design system's semantic tokens
(`bg-card`, `text-muted-foreground`, `bg-primary`, `border-border`) over the raw
hex values listed below; the hex values are given so the chart colours and
one-off tints can be reproduced exactly.

## Layout
One screen, a single scrolling column, max width 1080px, page padding 48px top /
40px sides / 64px bottom, vertical gap 28px between blocks. Page background
`hsl(40 20% 97%)`, body text `hsl(24 10% 10%)`. Blocks top to bottom:
header, hero + summary pair, daily spend, households, import sources, billing
links, footnotes.

### 1. Page header
- Left: title "AI import spend" — Young Serif, 30px, line-height 1.1. Subtitle
  "Production" — 14px, `hsl(25 5% 45%)`.
- Right: **Period** segmented control. Uppercase 12px caption "PERIOD"
  `hsl(25 5% 45%)`, then a pill group: container `hsl(40 20% 94%)`, 1px border
  `hsl(40 15% 88%)`, radius 11px, 3px padding. Options: **7 days · 30 days ·
  This month · All time** (default 7 days). Selected tab: white fill, radius 8px,
  shadow `0 1px 2px rgba(0,0,0,.06)`, text `hsl(24 10% 10%)`; unselected
  transparent, `hsl(25 5% 45%)`. Caption and tab group sit in one `flex:none`
  group so they never separate across a line wrap.

### 2. Hero card — "Last 24 hours" (top left, DS `Card`, padding 28px)
Fixed to the last 24 hours regardless of the Period control (24h is deliberately
not one of the period options). Grid share: 1.15fr against the summary card's 1fr,
gap 20px.
- Label "Last 24 hours" — 13px, weight 600, `hsl(25 5% 45%)`.
- Two big figures side by side, separated by a 1px vertical rule
  `hsl(40 15% 88%)` with 26px padding:
  - USD total — Young Serif 44px, `hsl(24 10% 10%)`, caption "INFERENCE"
    (11px, uppercase, letter-spacing .06em, `hsl(25 5% 52%)`).
  - Credit total — Young Serif 44px, `hsl(150 18% 30%)`, caption
    "SUPADATA CREDITS".
- Under them, one 13px muted line: "Yesterday: $0.12 · 8 cr". **No percentage
  badges** — percentage change is a noisy measure at these amounts and was
  deliberately removed.
- Footer strip above a 1px top rule (16px padding): four equal columns, gap 12px.
  Each column = 11px label (`hsl(25 5% 50%)`, `white-space:nowrap` so the four
  columns baseline-align), 17px weight-600 USD value, then a 12px weight-600
  credit line in `hsl(150 18% 32%)`. Columns: **Mean daily** ("10 cr · 30d") ·
  **Median daily** ("10 cr · 30d") · **Households** ("active in 24h") ·
  **Attempts** ("N via Supadata").

### 3. Summary card (top right, DS `Card`, padding 28px)
Two-column grid, column gap 20px, row gap 28px, content aligned to top. Six
tiles, each: 12px weight-600 label `hsl(25 5% 45%)`, Young Serif 24px value,
12px muted note. All six respond to the **Period** control; note text says which
period. Credit-valued tiles use `hsl(150 18% 32%)` for the value.
1. **Inference spend** — USD in period.
2. **Supadata credits** — credits in period (green value).
3. **Import attempts** — value is a ratio, `total/scraped` e.g. "653/416";
   note is exactly "total / use Supadata". Some sources are scraped without
   Supadata; that scraping is effectively free and is deliberately not tracked.
4. **Active households** — note "of N total".
5. **Avg inference / attempt** — USD to 3 decimals; note lists non-charging
   attempts, e.g. "27 no charge · 26 unknown".
6. **Avg credits / attempt** — **total credits in period ÷ all attempts**,
   including attempts that used no Supadata (green value); note
   "across all N attempts".

### 4. Daily spend card (DS `Card`, 24px top / 28px side padding)
- Header: "Daily spend" (Young Serif 18px), then an inline legend — 9px square
  swatches: Inference $ `hsl(18 70% 62%)`, Supadata cr `hsl(150 16% 42%)`.
  Far right, a 13px muted readout showing only the window length ("60 days") —
  no peak figures.
- **Window paging**: the chart shows at most **60 days**, and each arrow moves the
  window by **30 days**. The pager only appears when the selected period exceeds
  60 days (i.e. All time): 28px square buttons (radius 8px, white fill, 1px
  `hsl(40 15% 88%)` border) with ◀ / ▶ glyphs and a centred 12px date-range label
  ("27 Jun 2026 – 25 Aug 2026", min-width 150px). The button at the end of its
  range is disabled and greys to `hsl(25 5% 72%)`. Changing the period resets the
  window to the most recent one.
- Plot: 172px tall, baseline 1px `hsl(40 15% 88%)`, 22px label gutter below.
  **Two bars per day**, side by side inside a 44px max-width pair: USD bar
  `hsl(18 70% 62%)` and credit bar `hsl(150 16% 42%)`, radius 4px top corners,
  min-height 2px. Column gap 12px up to 20 days, 4px up to 40, 2px beyond;
  intra-pair gap 3px (1px past 20 days). On hover both bars darken
  (`hsl(18 75% 45%)` / `hsl(150 22% 28%)`, 120ms) and the label darkens to
  `hsl(24 10% 15%)`.
- **Hover tooltip**, anchored to the hovered bar pair (not the card header): dark
  popover `hsl(24 12% 14%)`, text `hsl(40 25% 96%)`, radius 9px, padding 9/12px,
  shadow `0 6px 18px rgba(40,25,15,.22)`, `pointer-events:none`, centred on the
  pair. Contents: date (12px weight 600), a swatched USD line ("$0.25
  inference"), a swatched credit line ("14 cr Supadata"), and an 11px
  `hsl(35 12% 70%)` line "11 import attempts". It sits above the bars, but flips
  to inside-top when the tallest bar in the pair exceeds ~96px so it never
  escapes the card.
- **Independent axes**, because the units are unrelated: left axis is USD, scaled
  to the window's USD peak, in `hsl(18 40% 42%)`; right axis is credits, scaled
  to the window's credit peak, in `hsl(150 16% 34%)`. Both show their peak at top
  and zero at the baseline. Bar heights are `value / axis peak × 145px`.
- X labels: weekday names when ≤14 days, otherwise "D Mon" on every
  `ceil(n/10)`th day. 11px `hsl(25 5% 55%)`.

### 5. Households card (DS `Card`)
- Header: "Households" (Young Serif 18px) left; right, 13px muted
  "{period} · ranked by" plus a two-option segmented control
  (**Inference $** / **Supadata cr**), same pill styling as Period at 12px.
  This control **only changes the sort order** of the rows — it must not fade,
  recolour, or de-emphasise either currency's bars or values.
- Column header row, 11px uppercase `hsl(25 5% 55%)`:
  grid `20px 1.5fr 1fr 88px 86px 84px`, gap 16px, 8px side padding —
  caret / name / "Share of all spend" / Attempts / Inference / Credits.
- Each household row: 1px top border `hsl(40 15% 88%)`, 14px vertical padding,
  radius 8px, hover fill `hsl(40 20% 96%)`, cursor pointer, expanded row keeps
  that fill.
  - Caret ▶ 11px `hsl(25 5% 55%)`, rotates 90° on expand (150ms).
  - Name in Young Serif 16px, truncated; meta line 12px muted ("3 members", or
    "deleted · history retained" for a deleted household).
  - **Two stacked bars** (7px tall, radius 999px, track `hsl(40 20% 94%)`,
    gap 4px): USD `hsl(18 72% 58%)` and credits `hsl(150 16% 42%)`. Each bar is
    that household's **share of the period's total spend in that currency**, so
    the bars **down the column sum to exactly one full bar**. Never scale against
    the largest household. A non-zero share is floored at 1% width for
    visibility, but a **zero value must render no bar at all** (a floor on zero
    both contradicts the "0 cr" value beside it and pushes the column over 100%).
  - Attempts 13px muted; inference 16px weight 600; credits 16px weight 600
    `hsl(150 18% 30%)`.
- **Expanded member list**: indented 44px left, 16px bottom padding. Grid
  `1.5fr 1fr 88px 86px 84px`, gap 16px, 9px vertical padding, 1px bottom border
  `hsl(40 15% 92%)`. Each member: 24px circular avatar
  (`hsl(40 20% 92%)` fill, 11px weight-700 initials `hsl(25 5% 40%)`), 14px name,
  then **two 5px stacked bars showing that member's share of their household** —
  USD `hsl(18 60% 72%)` and credits `hsl(150 14% 58%)`, as
  `member value / household total` (2% floor, again only for non-zero values) —
  then attempts, USD, credits.
- Deleted households/members render as "Household unavailable" / "Member
  unavailable" in `hsl(25 5% 55%)`; their history is retained.
- One household expands at a time; the first is open by default.
- Empty state (no imports at all): 1px top border, ~44px vertical padding,
  centred "No imports yet" (Young Serif 17px) + "Data starts at the first
  import." (14px muted).

### 6. Import sources card (DS `Card`, 24px top / 28px side / 28px bottom)
Breaks the period's imports down by source: **YouTube, Instagram, Link, Text,
Photo**. Header "Import sources" (Young Serif 18px) with the period label right.
- Three equal columns (gap 28px), one per measure: **Imports**, **Inference
  spend**, **Supadata credits**.
- Each column: a caption row where the 11px uppercase measure name
  (`hsl(25 5% 55%)`) is followed by the column total in Young Serif 16px (credits
  total in `hsl(150 18% 30%)`) — the total sits **outside** the chart, not in a
  donut hole. Below it, a 92px **solid pie** (a full pie, not a donut) drawn as inline
  SVG paths on a `0 0 100 100` viewBox, each slice stroked 1px white, next to a
  legend listing every non-zero source as swatch + name + value, sorted by import
  volume descending.
- Slice colours are fixed per source and shared by all three pies:
  YouTube `hsl(18 72% 56%)`, Instagram `hsl(6 48% 63%)`, Link `hsl(32 42% 68%)`,
  Text `hsl(42 28% 79%)`, Photo `hsl(150 14% 62%)`. Slices start at 12 o'clock and
  run clockwise in the same order in every pie. Sources with no credits simply
  have no slice in the credits pie.
- **Slice hover tooltip** (in addition to the legend): same dark popover styling
  as the chart tooltip, positioned 8px **below** the pie, centred. Two lines —
  swatch + source name (12px weight 600), then "value · percentage" with the
  percentage to one decimal ("310 cr · 44.0%"). Hover state is keyed per
  pie+source so only one tooltip shows at a time.
- Footer above a 1px top rule (`hsl(40 15% 90%)`, 22px above / 14px below):
  a 4-column grid `118px repeat(3, 1fr)`, gap 20px. Header labels 12px
  `hsl(25 5% 50%)`: (blank) / "Avg inference per import" / "Avg credits per
  import" / "Not billed by Supadata"; value row 13px weight 600 with the period
  label in the first cell, and the credits value in `hsl(150 18% 30%)`. The last
  cell reads "237 of 653 imports".

### 7. Billing links and footnotes
- A row of two DS `Button`s, `variant="outline" size="sm"`, gap 10px, each wrapped
  in `<a target="_blank" rel="noopener">`: **Inference billing ↗** and
  **Supadata billing ↗**. Default hrefs in the prototype are
  `https://console.anthropic.com/settings/billing` and
  `https://dash.supadata.ai/billing`; both are props — point them at whatever
  provider consoles the deployment actually uses.
- Below, two 12px `hsl(25 5% 48%)` footnotes (line-height 1.5, 8px apart, each
  prefixed with an ⓘ glyph aligned to the first line):
  1. "Inference cost is an estimate · collecting since {first data date}"
  2. "Supadata credits are counted as spent, never converted to USD. Remaining
     allowance is not exposed by the API, so it is not shown."

## Interactions & behaviour
- **Period control** (7 / 30 / This month / All time) drives the six summary
  tiles, the daily chart range, the households table, and the import-sources
  card. It does **not** affect the 24-hour hero card. Changing it clears chart
  hover and resets the chart window.
- **Chart hover** on a day column: both bars and the label darken and a tooltip
  appears anchored to that pair. Leaving the plot dismisses it.
- **Chart pager** ◀ / ▶: moves a 60-day window 30 days at a time through the
  selected period; disabled at each end; only rendered when the period exceeds
  60 days.
- **Pie slice hover**: shows the slice tooltip; leaving the slice clears it.
- **Ranked by** control: re-sorts household rows by USD or by credits, descending.
  No other visual change.
- **Household row click**: toggles the member list, one open at a time.
- Transitions: 120ms background on chart bars, 150ms transform on the caret,
  colour transitions on card hover. Nothing else animates.

## State management
- `period`: `'7' | '30' | 'month' | 'all'` — default `'7'`.
- `chartOffset`: integer ≥ 0, number of 30-day steps back from the most recent
  60-day window; clamped to `ceil((days - 60) / 30)`; reset to 0 on period change.
- `sortBy` (`metric` in the prototype): `'usd' | 'cr'` — default `'usd'`.
- `openHousehold`: household id or null — default the first household.
- `hoverDay`: index into the visible chart window, or null.
- `pieHover`: `"{measure}|{source}"` key, or null.
- `noData` flag for the day-one state (empty households block, zeroed figures).

### Data requirements
Per import attempt: timestamp, household id, member id/name, source
(YouTube / Instagram / Link / Text / Photo), inference cost in USD, Supadata
credits charged, and a charge state (`ok` / `none` / `unknown`). Everything on the
page is derived by aggregating those rows by day, household, member and source.
Deleted households/members must still aggregate, with names withheld.

Rules encoded in the design:
- Only **Link, YouTube and Instagram** imports charge Supadata credits (YouTube
  and Instagram cost 2 credits, Link 1); Text and Photo charge none.
- Attempts with state `none` or `unknown` are excluded from
  **Avg inference / attempt** (which divides by costed attempts only), but
  **Avg credits / attempt** divides total credits by **all** attempts.
- USD figures are formatted `$0.00`; per-attempt USD `$0.000`; credits as
  `1,234 cr`, and `9.8 cr` (one decimal) below 10.

## Design tokens
Colours
| Use | Value |
|---|---|
| Page background | `hsl(40 20% 97%)` |
| Card surface | DS `bg-card` (white) |
| Body text | `hsl(24 10% 10%)` |
| Muted text | `hsl(25 5% 45%)` |
| Faint text / axis labels | `hsl(25 5% 50-55%)` |
| Disabled control | `hsl(25 5% 72%)` |
| Border / rule | `hsl(40 15% 88%)`; card sub-rules `hsl(40 15% 90%)`; nested rows `hsl(40 15% 92%)` |
| Control track / avatar fill | `hsl(40 20% 94%)` / `hsl(40 20% 92%)` |
| Row hover | `hsl(40 20% 96%)` |
| Inference bar / hover | `hsl(18 70% 62%)` / `hsl(18 75% 45%)` |
| Inference household bar / member bar | `hsl(18 72% 58%)` / `hsl(18 60% 72%)` |
| Inference axis label | `hsl(18 40% 42%)` |
| Credit bar / hover | `hsl(150 16% 42%)` / `hsl(150 22% 28%)` |
| Credit member bar | `hsl(150 14% 58%)` |
| Credit text (figures) | `hsl(150 18% 30-32%)`; axis `hsl(150 16% 34%)` |
| Pie: YouTube / Instagram / Link / Text / Photo | `hsl(18 72% 56%)` / `hsl(6 48% 63%)` / `hsl(32 42% 68%)` / `hsl(42 28% 79%)` / `hsl(150 14% 62%)` |
| Tooltip surface / text / sub-text | `hsl(24 12% 14%)` / `hsl(40 25% 96%)` / `hsl(35 12% 70%)` |

Typography — Young Serif: 44px hero figures, 30px page title, 26px/16px source
totals, 24px tiles, 18px card titles, 15-17px names. Quicksand: 14px subtitle,
13px labels and readouts, 12px controls, tooltips and notes, 11px captions and
axis labels; weight 600 for labels and figures, 700 for avatar initials.

Spacing — page 48/40/64, block gap 28px, card padding 28px (chart/table/source
cards 24px top), grid gaps 12-28px, control padding 3px with 6-7px × 12-14px tab
padding.

Radius — cards DS `rounded-lg` (0.75rem); period group 11px; tabs and pager
buttons 8px; tooltips 9px; chart bars 4px top corners; pill bars 999px.

Shadows — selected segmented-control tab `0 1px 2px rgba(0,0,0,.06)`; tooltips
`0 6px 18px rgba(40,25,15,.22)`.

## Assets
No images or icon assets. The pies are inline SVG paths. The only glyphs are text
characters: ▶ ◀ ⓘ ↗.
Fonts (Quicksand, Young Serif) come from the PlanEatRepeat design system.

## Files
- `Dashboard v2.dc.html` — the full design prototype (markup + logic; the seeded
  data generator is at the top of the logic class).
- `screenshots/01-header-hero-summary.png` — header, 24h hero card, summary tiles.
- `screenshots/02-daily-spend-60day-window.png` — daily chart, All time, 60-day
  window with the pager.
- `screenshots/03-households-expanded.png` — households with a member list open.
- `screenshots/04-households-all.png` — all household rows, share-of-all-spend bars.
- `screenshots/05-import-sources-pies.png` — import sources pies and footer stats.
