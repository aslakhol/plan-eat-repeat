# Capture Scenes

Guide for adding new screenshot scenes as product states grow.

## Core Assumptions
- Web and mobile captures run against the same live local DB state.
- Do not add seed/reset logic to capture flows.
- New scenes should be stable with the current shared state and avoid destructive writes when possible.

## Scene Shape
Each scene should define:
- Start location (`/`, `/dinners`, deep-link route, etc.)
- UI actions needed to reach the state
- Ready check (something visible and stable)
- Output filename in `capture/web` or `capture/mobile`

## Web Scene Workflow
1. Add stable selectors in UI when needed (`data-testid`), instead of brittle class/text-only selectors.
2. Add/extend scene logic in `/Users/aslak/repos/plan-eat-repeat/apps/web/tests/capture.spec.ts`.
3. Keep scene names and output filenames explicit (example: `plan-first-day-drawer.png`).
4. Prefer assertions that work across realistic household data (for example, accept either empty/planned day drawer states).

## Existing Example
`capture plan first-day drawer screenshot` in `/Users/aslak/repos/plan-eat-repeat/apps/web/tests/capture.spec.ts`:
- Goes to `/`
- Clicks the first `plan-day-trigger`
- Waits for drawer state (`Surprise me!` or `Change plan`)
- Saves `capture/web/plan-first-day-drawer.png`

## Mobile Scenes (Future)
For mobile, follow the same scene idea:
- Open target deep-link
- Perform taps/swipes to reach state
- Wait for a ready marker (`accessibilityLabel` preferred)
- Capture and write output
