# Handoff: Public dinner — sharing a dinner (Plan Eat Repeat)

## Overview
A dinner in the Cookbook can be shared as a link. The link opens a **public web page** showing that dinner to anyone, signed in or not, and offers to add it to their own cookbook. The page is indexable, so it doubles as the app's main acquisition surface. This handoff covers three things: the **Share entry and drawer** inside the app, the **public page** (desktop and mobile), and the **add-to-my-cookbook flow** for a visitor.

Not covered: sharing a whole week, sharing to a specific person inside the app, and any social/profile surface. There are none — a share is a URL.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Recreate these designs in the existing Plan Eat Repeat app using its established patterns and component library. `Public dinner.dc.html` is the full design-review document; the canonical screens are the section labeled **4 / 4a** at the top, and sections 1–3 are the explorations behind it. `screens/` holds 2x screenshots of each canonical screen.

## Fidelity
**High-fidelity.** Colors, type, spacing and copy are final intent. Implement with the PlanEatRepeat design system (`@planeatrepeat/web`) — semantic tokens (`bg-background`, `bg-card`, `bg-primary`, `bg-muted`, `border-border`), Quicksand for UI text, Young Serif for dinner names and page headings, `rounded-lg` (0.75rem) brand radius. Hex values below are what the prototype renders; always prefer the matching semantic token.

## Relationship to existing surfaces
Read `design_handoff_cookbook/README.md` first. The dinner sheet in screen 1 **is** the Cookbook dinner sheet — unchanged apart from the third footer button. The public page reuses the sheet's recipe typography (bold fixed-width quantity column, italic muted prep note, Young Serif step numerals in primary) so that a visitor sees the product before they have it.

## Data model notes
- A share creates a **stable public slug** for the dinner: `planeatrepeat.com/d/<name-slug>-<id>`. One slug per dinner, reused if sharing is stopped and started again.
- The page serves the dinner **live** — the sharer's later edits appear on the page. It is not a snapshot.
- **Only the recipe is public**: name, tags, servings, ingredients, steps, notes. Never public: cook history ("14 times", "3 wks ago"), planned days, favourite state, the household's other dinners.
- Attribution is the **household**, not a person ("the Hendersons"). Households need a display name for this; if unset, ask for one at the point of first sharing.
- A saved copy stores `source_dinner_id`. That is what makes **"saved by N people"** countable and what powers the already-saved check on re-visit. The copy is otherwise fully detached — no sync in either direction.
- Stopping a share 404s the URL. Existing copies are unaffected.

## Screens / Views

### 1. Dinner sheet, Cookbook (`screens/01-dinner-sheet-share.png`)
Unchanged from the Cookbook handoff except the footer, which is now **three buttons** on the sheet floor, all white outline, none primary:

**Plan this dinner** · **Edit** · **Share**

- All three are **44px tall with their labels optically centred** (`display:flex; align-items:center; justify-content:center`), so the row reads as one strip.
- Widths: Plan takes `flex:1.4`, Edit and Share `flex:1` each — Plan has the longest label and is the likeliest action.
- **Share is a word, not an icon.**
- The ••• menu is untouched: Add to favourites · Merge · Delete dinner. Share deliberately does **not** appear there; it is a normal thing to do, not a management action.

### 2. Share drawer (`screens/02-share-drawer.png`)
A sheet that **replaces** the dinner sheet (back-chevron "‹ Spaghetti Carbonara" returns to it), rather than stacking over the action bar — it needs the room for the share status. Hugs its content.

Order, top to bottom:
1. Back link (12.5px, 700, muted).
2. Title **"Share dinner"** (Young Serif, 24px).
3. **Link box**: `#F7F4EE` fill, 1px `border-border`, 12px radius, the URL at 12px/600 (`#57504a`), and **Copy** in primary at the right end, inside the box.
4. **"Anyone with the link can read this dinner."** (11.5px, 600, muted) — sits **directly under the link box**, because it explains that URL. This is the only explanation in the drawer; no paragraph about privacy, no "your notes stay private".
5. **Share…** — filled primary, 44px, hands off to the OS share sheet.
6. Hairline, then the **share status**: **"Shared since 12 Aug"** (13.5px, 700) with **"Opened 6 times · saved by 2 people"** beneath (11.5px, 600, muted).
7. **Stop sharing** — centred text link, destructive tint `#a34524`, 12.5px 700. Always reachable, never a button.

**The link is created the moment the drawer opens** — there is nothing to confirm and no "create link" state. If the dinner is not yet shared, the status block reads **"Shared just now"** and the counts are omitted until they are non-zero (`Opened 6 times` and `saved by 2 people` each drop out at zero rather than showing "0").

*Implementation note:* the open/save counts are nice-to-have. Ship the drawer with the link, the explanation, Share… and Stop sharing; `saved by N` is cheap once copies carry `source_dinner_id`, so it can land early. Open counts can follow.

### 3. Public page — desktop (`screens/03-public-page-desktop.png`)
A **recipe page**, not the app in a browser. Warm off-white `#FAF8F5`, single column of content, max measure around 760px.

- **Top bar**: wordmark "Plan Eat Repeat" (Young Serif, primary) left; **Add to my cookbook** filled primary right. 1px bottom border.
- **Attribution line**: 26px circular avatar (`#F6DDD2` fill, primary initial) + **"Shared by the Hendersons · 12 August"** (12px, 600, muted).
- **H1**: dinner name, Young Serif ~34px.
- **Chip row**: tags plus servings as a final chip, same chip style as the app.
- Hairline, then a **two-column grid**, `210px 1fr`, 30px gap: **Ingredients** left, **Method** right. Both under uppercase 11px/700 tracked section labels in muted. Quantities in the bold fixed-width column; step numerals Young Serif in primary.
- **Footer strip**: `#F7F4EE`, 1px top border. The rotating upsell line (Young Serif, 15px) with the fixed second line beneath (12.5px, 600, muted), and **Add to my cookbook** repeated at the right.
- Everything is real markup for search: the recipe must be in the HTML response, not fetched client-side, and should carry Recipe structured data (name, ingredients, instructions, yield, author = household name).

### 4. Public page — mobile, top (`screens/04-public-page-mobile-top.png`)
The app's dinner card lifted onto the web. Page background is the warm stone `#F2EFE8`; the recipe sits on a **white card**, 16px radius, 1px `border-border`, soft shadow — the same relationship a sheet has to the week behind it.

- Small wordmark above the card, no top bar and no button up there.
- Card order: attribution line → dinner name (Young Serif 26px) → tag chips → **Add to my cookbook** (filled primary, 44px) → hairline → servings → ingredients → steps.
- **The button sits above the recipe, not below it.** It is never below the fold, and no pinned bar covers the method while someone is cooking from the page.
- One column. Same content as desktop, same order.

### 5. Public page — mobile, foot (`screens/05-public-page-mobile-foot.png`)
The recipe card ends and a second card follows: the **upsell**, which is the desktop footer strip in card form.
- White card, 16px radius, ~16px 18px padding: the rotating line (Young Serif, 16px), the fixed second line (11.5px, 600, muted), then **Add to my cookbook** (filled primary, 44px).
- It appears **only after the recipe** — a visitor who has just arrived wants the dinner, not the pitch. Costs about 100px.

### 6. Save — no account yet (`screens/06-save-no-account.png`)
**Add to my cookbook** with no session opens a bottom sheet over the page; the recipe stays visible behind it, dimmed.
- Title: "Save **Spaghetti Carbonara** to your cookbook" (13px, 600; name in Young Serif).
- **Continue with Apple** · **Continue with Google** · **Use an email address** (the third with a dashed `#d4ccbc` border, transparent fill).
- Footer line: the fixed **"Plan Eat Repeat is a free cookbook and dinner planner."**
- Nothing else is asked for. No name, no household setup, no onboarding before the save — the dinner is saved first and onboarding happens on the far side, in the app.

### 7. Saved (`screens/07-saved.png`)
Same sheet, new content.
- Title: "Saved to your cookbook".
- **Plan it** (filled primary) then **Open my cookbook** (white outline), stacked full-width.
- Footer line: **"Your copy. The Hendersons won't see your changes."**
- **Plan it** goes to the day picker for the current week. A saved dinner that is never planned is a dead end, so this is the offer.

### 8. Already saved (`screens/08-already-saved.png`)
If `source_dinner_id` already exists in this household's cookbook:
- Title: "Already in your cookbook".
- Two equal buttons side by side: **Open it** · **Save a copy**.
- Footer line: "You saved it on 3 August."
- Never silently duplicate. Links get re-sent, and duplicates are how a cookbook rots.

### 9. Upsell copy pool (`screens/09-copy-pool.png`)
One line is chosen **at random per page load** and used in both the desktop footer strip and the mobile upsell card. Verbatim:

1. Never wonder what's for dinner.
2. All your recipes in one place.
3. Stop screenshotting recipes.
4. All your meal planning in five minutes.
5. Rescue your recipes from the group chat.
6. Fewer trips to the shop at half five.
7. Fewer hungry trips to the shop.
8. No more “whats for dinner”
9. Everyone knows whats for dinner.

Second line, fixed under every one of them: **Plan Eat Repeat is a free cookbook and dinner planner.**

**The chosen line must be rendered server-side**, not swapped in after load — a line that appears only after hydration is a layout shift and looks like cloaking. Rotation is safe for search because the line is not the `<title>`, the `<h1>`, or part of the recipe markup; those stay stable per dinner.

## Interactions & Behavior
- **Share** → drawer, link already live. **Copy** copies and confirms with a toast. **Share…** opens the OS share sheet with the URL and the dinner name as the subject.
- **Stop sharing** asks for confirmation, then 404s the URL. Wording should say that people who already saved it keep their copy.
- Editing a shared dinner updates the page. No warning, no republish step.
- Public page needs no session to read. **Add to my cookbook** with a session saves immediately and shows screen 7; without one it shows screen 6, then 7 on the far side of auth — the dinner being saved must survive the auth round trip.
- On mobile, do not show an app-install interstitial over the recipe. The wordmark and the upsell card are the whole app presence.
- Copy that ships in the drawer is exact: "Anyone with the link can read this dinner.", "Stop sharing", "Shared since 12 Aug", "Opened 6 times · saved by 2 people".

## Open questions
- Household display name: needed for attribution. Prompt at first share, or derive from the account holder's name?
- Whether "Opened N times" is worth the tracking it implies. `saved by N` is free; opens are not.
- Whether a public page should show anything about the household beyond the name — currently deliberately nothing, no link, no other recipes.
