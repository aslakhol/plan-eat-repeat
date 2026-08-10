# AI recipe import — implementation spec

Canonical design: `Canvas-4.dc.html`, frame **7a** (screens `#s01`–`#s12`). Open it in a browser; `support.js` sits beside it and must stay there. Frames 4–6 in the same file are the exploration behind it and are not binding.
`screens/` holds 2× screenshots of each canonical screen.

These files are **design references created in HTML** — intended look and behaviour, not production code to copy. Rebuild in the app with the PlanEatRepeat component library; hex values in this spec are what the prototype renders, always prefer the matching semantic token.

When sources disagree, this README is authoritative, followed by the canonical screenshots/HTML, current application behavior, and then old issues.

Design system: PlanEatRepeat. Use semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`), `rounded-lg` radius, Quicksand for UI text, Young Serif for dinner names and screen titles.

The canonical screens target mobile browsers at approximately 390px wide. Support roughly 320–480px without overflow. Desktop must remain functional, but desktop visual redesign and Expo parity are deferred.

---

## 1. The model

The AI reads a source, returns a recipe object in our format, and we drop it into the **ordinary recipe editor**. There is no review screen. Nothing is persisted until the user hits Save in that editor — Cancel discards the import entirely.

Sources: **link** (any recipe page), **YouTube video**, **photos**, **text** (pasted or typed). Link and YouTube are separate entry labels but both URL screens accept either kind of URL and choose the acquisition pipeline from the parsed URL. Plus two non-AI paths: **Just a name** and **Write it myself**.

---

## 2. Add a dinner sheet — `01`, `02`

Bottom sheet, opened by ＋ in the tab bar from any tab.

```
Add a dinner
[ What's for dinner?            ] [＋]
IMPORT A RECIPE
  Link                            ›
  YouTube video                   ›
  Photos                          ›
  Text                            ›
  ─────────────
  Write it myself                 ›   (dashed border, no fill)
```

- Name field is focused on open. ＋ is disabled while empty; enabled and primary-filled once there is a name (`02`).
- **The source rows never disable.** A typed name is simply an import that already has a name: tapping any source runs that import and the user's name is considered the original name and AI name is presented against it (see §7).
- ＋ alone: saves a dinner with a name and no recipe, then brings you to the cookbook with the sheet for that dinner open.
- **Write it myself**: opens the empty editor, pre-filled with the typed name if there is one.
- Row labels are single-line. No subtitles, no help text anywhere in this sheet.

## 3. Source screens — `03`–`07`

Each source pushes within the same sheet. Back link `‹ Add a dinner` top-left. Primary button is **Import recipe** in every case.

| Screen | Content |
|---|---|
| `03` Link | One URL field. If the clipboard holds a URL on open, pre-fill it (still editable). Accepts ordinary pages and YouTube URLs. |
| `04` YouTube | One URL field with the same validation, clipboard prefill, and accepted URL types as Link. Dedicated metadata preview is deferred. |
| `05` Photos, empty | Dashed placeholder box ("No photos yet") + **Choose photos** (primary) and **Take a photo**. The dashed box also opens choose photo. |
| `06` Photos, picked | 3-up grid of thumbnails in shot order, ✕ overlay on each to remove, dashed ＋ tile to add more through the photo library/file chooser. **Order is passed to the AI** — ingredients and steps are often on different pages. |
| `07` Text | Tall multiline field, ~8 lines then scrolls. Paste or type. No word count. |

Photos and camera both use native browser file inputs; use the capture hint for **Take a photo** rather than building camera UI. Keep the existing four-photo limit. At the limit, hide or disable the add tile and expose concise accessible limit feedback.

## 4. Loading — `08`

**Blocking full page**, not a sheet. Nothing behind it is tappable, no swipe-to-dismiss.

- Crossed-utensils icon (lucide `utensils-crossed`) in a `#F6DDD2` disc with a primary border, **rotating slowly and continuously** (~3s per turn, linear). This is the only motion on the page.
- Title: `Reading the recipe`. Under it, the source in muted text (host name, video title, "4 photos").
- Three reassuring progress phases: filled check = done, tinted ring = in progress, empty ring = pending. The current import API is one request, so the progression may be presentational rather than server-reported telemetry; mark every phase complete only when the import succeeds.
  - link — Fetching the page / Reading the recipe / Structuring it
  - video — Fetching the video / Reading the recipe / Structuring it
  - photos — Reading the photos / Reading the recipe / Structuring it
  - text — two steps only: Reading the recipe / Structuring it
- **Cancel** pinned at the bottom: immediately returns to the source screen with its input intact and aborts the client request. Propagate cancellation through page/video acquisition and AI generation wherever the underlying APIs support it; provider work already accepted may still complete.

## 5. Errors — `09`

Same blocking page, contents swapped. The rotating icon is replaced by a static `!` mark in a plain white disc — the utensils belong to work in progress, not to outcomes.

- Heading: short, plain, no blame. Example designed: **Couldn't reach the site** / "seriouseats.com didn't answer. It may be down, or your connection dropped."
- For a new Dinner, always three ways out in this order: **Try again** (primary) · **Write it myself** (opens the empty editor, name preserved) · **Back** (returns to the source screen, input intact).
- For an existing Dinner, **Write it myself** returns to the existing editor exactly as it was before import; it does not clear or change any field.
- Only the heading and one-sentence body vary per error type. Keep the existing machine-readable categories (failed/blocked/unreadable source, no recipe, extraction failure) and provide short, plain, blame-free copy for sites, photos, and videos.

## 6. Landing in the editor — `10`

The normal recipe editor, populated. Explicitly **not** designed:

- no "review the AI's work" banner
- no per-field highlighting or provenance marking
- no confirmation before import overwrites the form

Fields the AI fills now: name, servings, source link, multipart ingredients (amount / unit / item / preparation note), and steps. AI tag suggestions are deferred. Existing Household import instructions continue to apply to every AI source.

**Editor chrome changed for this work** (applies to the editor generally, both new and existing dinners):
- Top bar: `Cancel` · title · `•••`.
- **Save moved to a fixed bar at the foot of the screen**, full-width primary "Save dinner". It previously sat in the top bar and collided with •••.

## 7. Name conflict — `11`

Only when the user typed a name **and** the AI returned a different one.

- The user's name stays in the Dinner name field.
- Directly under it, a `#F5F1EA` strip: `The source calls it "Sheet-Pan Chicken Tacos"` followed by two pill buttons — **Keep our name ✓** (outlined primary, preselected) and **Use theirs**.
- Either tap dismisses the strip. **Use theirs** writes the AI's name into the field. The field stays editable throughout.
- If the user typed no name, the AI's name is used silently and no strip appears.
- Compare names after trimming, collapsing repeated whitespace, and ignoring capitalization. Punctuation or wording changes still count as different. The strip is non-blocking; the user's name remains unless **Use theirs** is selected.

### Source Link conflict

Use the same non-blocking conflict pattern when an existing Dinner and an imported URL provide different Source Links.

- Keep the existing Source Link in the field initially.
- Show `The source link is "…"` with **Keep our link ✓** and **Use theirs**.
- If the Dinner has no Source Link, use the imported URL silently.
- Photo and text imports preserve an existing Source Link.
- Name and Source Link conflicts may appear as two independent strips.
- Before comparison, normalize the hostname and trailing slash and ignore URL fragments and common tracking parameters. Only a remaining source-identity difference opens the strip.

## 8. Import into an existing dinner — `12`

- Entry point is **Import a recipe…** as the first item of the editor's ••• menu, above `Clear the recipe` and `Delete dinner`.
- Opens the same source sheet, minus the name field and minus **Just a name** — only the four AI sources and Write it myself.
- **Import replaces Recipe content without a confirmation dialog.** Drop all existing Recipe parts and populate the imported servings, Source Link, parts, ingredients, preparation notes, and steps. Preserve existing tags and notes. Name and Source Link use the conflict rules above. Nothing is saved until Save, so cancelling the editor discards the imported draft.
- **Write it myself** on an existing Dinner simply returns to its unchanged editor. It never clears existing content.
- **Clear the recipe** appears only when Recipe parts or servings exist. It clears Recipe parts and servings while preserving name, tags, notes, and Source Link.
- **Delete dinner** remains available and uses the Cookbook's destructive confirmation, including the warning and list of Plan Slot dates whose Cooking History will be lost.
- **Merge** stays hidden until implemented.
- Most common real case: a dinner that is only a name, gaining a recipe.

## 9. Behaviour notes

- Cancel at any point in the import (sheet, loading, error) leaves the cookbook untouched.
- The typed name survives every branch: source screens, loading, error fall-through, and the editor.
- Re-running an import only refills the unsaved editor; it has no persistence effect until Save.
- Saving a globally-created Dinner navigates to the URL-addressed Cookbook sheet for that Dinner. Saving from a Plan Slot-attached flow plans the Dinner and returns to Week with its planned-day sheet open. Cancelling the editor closes the sheet stack and returns to the bare originating tab; transient search/filter state may reset.
- Disable **Import recipe** until the source is valid. Show concise inline validation and recoverable camera/photo-processing errors without losing selected input. Clipboard access is optional and fails silently.
- The next AI-tag phase should receive the Household's existing tag vocabulary and may select from it, but must not create new tags.

## Deferred

- YouTube thumbnail/title/channel/duration preview.
- AI tag suggestions.
- Expo parity and desktop visual redesign.
- Date-only Plan Slot storage and a database-enforced unique Household/date constraint.
