# Favourites — implementation spec

A favourite is one explicit boolean on a dinner. It does two things: it draws a
mark wherever the dinner is named in a list, and it pins the dinner to the top of
the **Favourites** sort. Nothing else in the product changes.

Visual source of truth: `Favourites.dc.html`, turn 7 (`#7a`). Turns 5 and 6 are
the explorations behind it and are not canonical. Where this implementation
spec explicitly differs from the visual record, this spec takes precedence.

Scope: the responsive Next.js web app. Expo parity is deferred.

## The mark

A filled heart in primary terracotta `#DD6B42`.

```html
<svg viewBox="0 0 24 24" fill="#DD6B42">
  <path
    d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 3.6C20 16.1 12 21 12 21z"
  />
</svg>
```

- **In lists:** 13px, trailing the dinner name with a 5px gap, inside the name row
  — never leading the name (the left edge of the list must stay straight) and never
  in the tag row of a two-line row.
- **In sheets:** a chip at the head of the tag row — 12px heart, no label,
  `background:#F6DDD2; border-color:#e7b9a4; padding:3px 8px`, same height and
  radius as a tag chip.
- **Not favourited:** nothing is rendered. No ghost, no outline, no reserved slot.
- **Nowhere is the heart tappable.** It is a readout in every position.
- **Accessibility:** the SVG is decorative, while screen-reader text announces
  `Favourite` with the Dinner name or inside the sheet chip.
- **No tags:** a favourited Dinner still renders the sheet chip on its own row.

## The control

The only way to toggle is the ••• menu on the Cookbook Dinner sheet:

- not favourited → **Add to favourites** (first row)
- favourited → **Remove from favourites** (same position)

The menu keeps its two implemented rows (favourite / Delete dinner) and its
existing behaviour — plain words, no icons, no dimming underneath. Merge remains
deferred; the visual record's Merge row is not part of this feature.

## The Favourites sort

Available in the Cookbook list and in the empty-day picker, third in the segmented
control. Two blocks, no headings on the first:

1. Every favourited dinner, ordered by Cooking Frequency descending; ties break
   A–Z.
2. A `Most planned` section label (`.secl`: 11px, 700, uppercase, `#a39a8e`), then
   every remaining dinner using the same Cooking Frequency and A–Z ordering.

Cooking Frequency counts past Plan Slots only. If names also compare equally,
Dinner ID is the final deterministic tie-break.

The `x wks ago` / `tonight` right-hand meta is unchanged in both blocks. Render
the `Most planned` seam only when the currently visible, filtered result contains
both blocks. If either block is empty, omit the seam; with no visible favourites,
the sort degrades to plain most-planned.

## Where the mark appears

| Surface                           | Mark                                                          |
| --------------------------------- | ------------------------------------------------------------- |
| Cookbook list, all three sorts    | 13px heart after the name                                     |
| Empty-day picker, all three sorts | 13px heart after the name                                     |
| Cookbook dinner sheet             | heart chip, head of tag row                                   |
| Planned-day sheet (Week)          | heart chip, head of tag row                                   |
| Week day rows                     | **none — deliberate**                                         |
| Plan-this-dinner day pills        | none                                                          |
| Tag filter sheet                  | none — favourite is not a tag and never appears in the funnel |

Week rows carry no mark: those seven dinners are already chosen, so the flag adds
no information there and its terracotta would compete with today's border.

## Screens

| File                                     | Screen                                                       |
| ---------------------------------------- | ------------------------------------------------------------ |
| `screens/1-cookbook-favourites-sort.png` | Cookbook, Favourites sort, with the Most planned seam        |
| `screens/2-cookbook-a-z.png`             | Cookbook, A–Z — hearts scattered, incl. two-line tagged rows |
| `screens/3-dinner-sheet-favourited.png`  | Dinner sheet, favourited — chip in the tag row               |
| `screens/4-dinner-sheet-menu.png`        | Dinner sheet, not favourited, ••• open                       |
| `screens/5-picker-favourites-sort.png`   | Empty-day picker, Favourites sort                            |
| `screens/6-planned-day-sheet.png`        | Planned-day sheet with the chip                              |
| `screens/7-week-rows-no-mark.png`        | Week rows, deliberately unmarked                             |
