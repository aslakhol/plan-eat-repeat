# Automated Parity Workflow (Web + Android Emulator)

This workflow captures screenshots for `plan` and `dinners` from both apps and composes side-by-side comparisons.

It is intentionally simple:
- It uses your current development DB data.
- It does not reset or reseed the DB.
- It uses explicit screen-ready markers in the mobile app (`parity-ready-plan` / `parity-ready-dinners`) before capturing.

## Prereqs
- `pnpm`, `adb`, and ImageMagick (`magick`) installed.
- Android SDK emulator installed (or any connected Android device).
- One mobile runtime installed on the emulator/device:
  - Preferred: app dev build (`com.planeatrepeat.mobile`)
  - Fallback: Expo Go (`host.exp.exponent`)
- Browser dependency installed once:
```bash
pnpm --filter @planeatrepeat/web exec playwright install chromium
```

## Run parity capture
From repo root:
```bash
pnpm parity:capture
```

What this command does:
- Captures web parity routes with Playwright.
- Ensures web API server is reachable for mobile app data.
- Starts mobile dev server when needed.
- Opens mobile `plan` and `dinners` via deep links.
- Waits for explicit mobile ready markers.
- Captures screenshots and composes side-by-side outputs.

## Useful env overrides
- Reuse existing servers:
```bash
PARITY_REUSE_WEB_SERVER=true PARITY_REUSE_MOBILE_SERVER=true pnpm parity:capture
```
- Increase mobile wait window:
```bash
PARITY_SCREENSHOT_WAIT_SECONDS=150 pnpm parity:capture
```
- Override mobile readiness pattern (regex):
```bash
PARITY_SCREENSHOT_READY_PATTERN='parity-ready-plan|parity-ready-dinners' pnpm parity:capture
```
- Adjust web capture framing:
```bash
PARITY_WEB_VIEWPORT_WIDTH=412 PARITY_WEB_VIEWPORT_HEIGHT=915 pnpm parity:capture
```

## Outputs
- `parity/web/plan.png`
- `parity/web/dinners.png`
- `parity/mobile/plan.png`
- `parity/mobile/dinners.png`
- `parity/side-by-side/plan.png`
- `parity/side-by-side/dinners.png`

## Single-screen mobile capture
```bash
scripts/parity/capture-mobile-screen.sh plan
```
