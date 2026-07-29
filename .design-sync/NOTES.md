# design-sync notes — PlanEatRepeat

Repo-specific gotchas for syncing this design system to claude.ai/design.
Read this before re-running the sync.

## What the "design system" is here

There is no separate design-system package and no Storybook. The synced surface
is `apps/web/src/components/ui/` — the shadcn/ui component set the web app is
built from (108 exported components), styled by Tailwind 3.4 with the
"Warm Stone" CSS-variable theme in `apps/web/src/styles/globals.css`.

`apps/web/src/components/*.tsx` (AppLayout, AppSidebar, Modal, ResponsiveModal)
are deliberately **out of scope**: they import Clerk, tRPC and `next/router`, so
they cannot render in a preview and are app shell rather than design system.
That exclusion is enforced by `cfg.srcDir = "src/components/ui"`.

## Per-clone setup (not committed, must be recreated)

- **The package self-link.** The converter resolves the package as
  `join(<node-modules>, <pkg>)`, but pnpm does not self-link a workspace app.
  Recreate it before building:
  ```sh
  mkdir -p node_modules/@planeatrepeat && ln -sfn ../../apps/web node_modules/@planeatrepeat/web
  ```
  Without it the build fails to find the package directory.
- **`--node-modules` must be the repo root, not `apps/web/node_modules`.** The
  repo sets `node-linker=hoisted` in `.npmrc`, so `react` and everything else
  lives at the root; `apps/web/node_modules` holds only three scoped dirs.
- **Restage the converter scripts** (`.ds-sync/`) and reinstall its deps —
  both are gitignored.

## Why some inputs live under `apps/web/` instead of `.design-sync/`

`cfg.cssEntry` is bounded to the package directory by the converter, and
package-relative paths resolve through the self-link (so `../..` lands inside
`node_modules`, not the repo root). Two design-sync inputs therefore live
inside the package:

- `apps/web/design-sync-styles/` — the Tailwind build that produces the
  shipped stylesheet.
- `apps/web/design-sync-docs/` — one `.md` per component. These set the
  component grouping (via `category:` frontmatter) and become each component's
  `.prompt.md`, which is what the design agent reads.

Both are committed. `.design-sync/` still holds config, notes, conventions and
the authored previews.

## The stylesheet is generated, and must be rebuilt before the converter

`cfg.buildCmd` is `sh apps/web/design-sync-styles/build.sh`. It regenerates
`candidates.txt` and compiles `ds.css` (~1.2 MB minified, gitignored).

The subtlety worth understanding: a Next.js app has no compiled stylesheet on
disk, and Tailwind only emits utilities it can see in `content`. Designs the
Claude Design agent writes later are not in `content` at build time, so
`gen-candidates.mjs` synthesises a corpus of ~18k plausible utility class names
(layout, spacing, sizing, typography, the semantic colour palette, states and
breakpoints) purely so those utilities exist in the shipped CSS. Widen that
generator rather than hand-editing `ds.css`.

**Rebuild the stylesheet whenever an authored preview uses a new utility** —
`.design-sync/previews/**/*.tsx` is in the Tailwind `content` globs, but only
the full `build.sh` re-reads it. Subagents authoring previews cannot run it
(it is a shared-artifact command), so give every preview batch this house rule:

> **Named scale values only — no arbitrary values in square brackets.**
> `w-[380px]` compiles to nothing and fails silently. A bracket class only
> works if that exact string already appears somewhere in `apps/web/**` (which
> is why `min-h-[100px]` survives — `views/Dinners/DinnerList.tsx` uses it).

The same constraint applies to designs built in claude.ai/design, and is
documented for the design agent in `conventions.md`.

## Toast: the imperative API needs `extraEntries`

`toast()` and `useToast` live in `src/components/ui/use-toast.ts`, a `.ts` file.
The synth entry only re-exports `.tsx`/`.jsx`, so they were initially missing
from the bundle. Fixed by
`"extraEntries": ["./src/components/ui/use-toast.ts"]` — keep that entry, or the
design agent gets `Toaster` with no way to drive it.

The `Toaster` preview still reproduces the markup `Toaster` emits rather than
firing a real `toast()`, because it was authored before the export landed. A
future sync could improve it: fire one from a `useEffect` now that `toast` is
importable.

## Fonts

Quicksand and Young Serif are loaded by a remote `@import` from Google Fonts in
`design-sync-styles/input.css`, and `--font-quicksand` / `--font-young-serif`
are bound to them in `:root`. In the app itself these variables come from
`next/font/google` at runtime; the design system cannot rely on that, hence the
CDN import. Validate reports `[FONT_REMOTE]` for this — expected, not a defect.

If the fonts ever need to be self-hosted, `next/font` caches the woff2 files in
`apps/web/.next/static/media/` under content-hashed names, but nothing on disk
maps a hash back to a family — identify them before shipping any of them.

## Authoring previews — techniques that work here

Folded in from the four authoring batches. Each of these cost a debugging cycle.

- **Portalling overlays** (`Dialog`, `Sheet`, `Drawer`): set `open` on the root
  AND keep the `*Trigger` in the tree. The panel portals to `document.body`, so
  without the trigger the card root is empty and the render check fails; the
  trigger ends up under the dim overlay, which is fine.
- **`CommandDialog` exports no trigger.** Wrap it in a `div` beside a plain
  `Button` styled as the ⌘K affordance. Reuse this shape for any portalling
  component with no trigger export.
- **`Drawer` needs `shouldScaleBackground={false}`.** Vaul's default expects a
  `[vaul-drawer-wrapper]` ancestor the preview harness does not provide.
- **`Tooltip`** needs a `TooltipProvider` inside the preview file — not a
  harness-level `cfg.provider`.
- **Every `Sidebar*` part** needs `SidebarProvider` → `Sidebar` with
  `collapsible="none"`. The default branches are `position: fixed` +
  `hidden md:block`, so nothing renders in flow. Constrain the panel's box with
  an inline `style` prop, not Tailwind: `twMerge` does not recognise
  `min-h-svh`, keeps it alongside `min-h-0`, and `min-height` then beats any
  `height` class — so no class can size `SidebarProvider`.
- **`Toast`** needs both `ToastProvider` and `ToastViewport` in the tree, plus
  `duration={Infinity}` or it auto-dismisses before the screenshot. Override
  only `static flex-col p-0` on the viewport so the app's real width cap shows.
- **`AvatarImage` never loads** in the capture sandbox — every Avatar cell falls
  through to `AvatarFallback`. Write the initials to read well; that is the
  honest app state anyway.
- **`Separator orientation="vertical"`** is `h-full w-[1px]` and collapses
  without a height on itself or the flex row.
- **`Label`'s `peer-disabled:` dimming** only reaches a label that follows its
  peer in the DOM; `flex-col-reverse` is how to demonstrate it honestly.
- **`SelectContent` inherits the trigger's width**, so keep the trigger at a
  scale width or the panel overflows the card.
- **`FancyCombobox` has no `open` prop** — the menu follows the input's focus
  state, so an open story focuses the input from a `useEffect`. Its list is
  capped at `max-h-[35dvh]`; keep the selectable set to 4 on a 560x420 card.
- Card sub-parts, Sidebar parts and Select parts render nothing standalone —
  their honest preview is the full parent composition, framed so the subject
  part is what the eye lands on.

## Orchestration: do not edit config during a fan-out

`preview-rebuild.mjs` hard-exits with `[CONFIG_STALE]` when
`.design-sync/config.json` changes after the stamped build, and there is no
bypass flag. Editing config mid-wave therefore breaks **every** scoped agent at
once — it cost this run one batch's grading pass. Batch config edits before a
wave starts or after it folds, never during.

(Also: a wait-loop using `pgrep -f "preview-rebuild.mjs"` matches its own shell
and never exits. Wait on a PID.)

## Card modes (presentation, set from `[GRID_OVERFLOW]`)

`cfg.overrides` pins how six components present in the product's card grid:
`Toast`/`Toaster` are `single` (their viewport is fixed/portalled, so no grid
layout can hold them), and `Command`/`CardContent`/`CardFooter`/`CardHeader` are
`column` (their stories are wider than a grid cell). The seven overlay
components are `single` with explicit viewports. These are presentation-only —
grades carry across changes to them.

## Found in passing, not fixed

`CommandEmpty` in `src/components/ui/command.tsx` sets `className` *before*
spreading `{...props}`, so a caller-supplied `className` replaces its base
styles instead of merging through `cn` — unlike every other component in that
file. Worked around in the preview by not passing a className.

## Known render warns (triaged, not new)

- `[FONT_REMOTE] "Quicksand", "Young Serif"` — by design, see above.
- `tokens: 1 missing` — below the converter's threshold; the referenced
  custom property is defined at runtime, not in the stylesheet.
- Components left on the floor card are structural sub-parts (portals,
  overlays, scroll buttons) that render nothing standalone. That is the
  documented baseline, not a failure.

## Re-sync risks

- **The self-link and `.ds-sync/` are recreated per clone** (above). A re-sync on
  a fresh machine that skips them fails at the first build.
- **`ds.css` is gitignored and generated.** A re-sync that does not run
  `buildCmd` first will either fail (`cssEntry` not found) or, worse, ship a
  stale stylesheet missing utilities that newer previews use.
- **The candidate corpus is a guess, not a contract.** If designs built in
  claude.ai/design come out partly unstyled, the cause is almost certainly a
  utility family missing from `gen-candidates.mjs` — check the rendered design's
  class names against `ds.css` before suspecting anything else.
- **Component docs are hand-written.** Adding a component to
  `src/components/ui/` without adding `apps/web/design-sync-docs/<Name>.md`
  drops it into a `misc` group and gives it a synthesised prompt instead of a
  real one. The converter prints `[DOCS_UNMAPPED]` when this happens.
- **Google Fonts is a runtime dependency of every rendered design.** If the
  design environment blocks external hosts, everything falls back to system
  fonts and nothing in the pipeline will flag it.
