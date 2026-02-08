# Automated Parity Workflow (Web + Android Emulator)

This workflow captures parity screenshots for `plan` and `dinners` without manual phone interaction:
- Web screenshots are captured by Playwright.
- Mobile screenshots are captured from Android via deep links.
  - Dev build: `planeatrepeat://plan`, `planeatrepeat://dinners`
  - Expo Go fallback: `exp://127.0.0.1:8081/--/plan`, `exp://127.0.0.1:8081/--/dinners`
- Side-by-side outputs are generated with ImageMagick.

## Prereqs
- `pnpm`, `adb`, and ImageMagick (`magick`) installed.
- Android SDK emulator installed (or any connected Android device).
- One mobile runtime installed on the emulator/device:
  - Preferred: app dev build (`com.planeatrepeat.mobile`), or
  - Fallback: Expo Go (`host.exp.exponent`)
- Web env configured for bypass (set automatically by `run.sh`, overridable):
  - `PARITY_BYPASS_AUTH=true`
  - `PARITY_BYPASS_TOKEN=<token>`
  - `PARITY_BYPASS_USER_ID=parity-user`
  - `PARITY_BYPASS_HOUSEHOLD_ID=parity-household`
- Mobile parity envs (set automatically when starting parity mobile scripts):
  - `EXPO_PUBLIC_PARITY_BYPASS_AUTH=true`
  - `EXPO_PUBLIC_PARITY_BYPASS_TOKEN=<same token as web>`
  - `EXPO_PUBLIC_PARITY_API_URL=http://127.0.0.1:3100` (or custom parity web port)

## One-time setup
1. Ensure local DB and env are configured.
2. Install browser dependency once:
```bash
pnpm --filter @planeatrepeat/web exec playwright install chromium
```
3. Install one Android runtime once:
```bash
pnpm dev:mobile:parity:android
```

If you use Expo Go fallback, keep a parity mobile dev server running:
```bash
pnpm dev:mobile:parity
```

## Daily parity capture
From repo root:
```bash
pnpm parity:capture
```

By default this command resets local DB with deterministic parity seed (`PARITY_RESET_DB=true`).
It also starts:
- a web parity server on `PARITY_WEB_PORT` (default `3100`) for mobile API calls
- a mobile parity dev server on `PARITY_EXPO_PORT` (default `8081`) if one is not already running

To skip DB reset:
```bash
PARITY_RESET_DB=false pnpm parity:capture
```

To skip mobile server auto-start:
```bash
PARITY_START_MOBILE_SERVER=false pnpm parity:capture
```

For deterministic runs, existing web/mobile dev servers on parity ports will fail the script by default.
To explicitly reuse already-running servers:
```bash
PARITY_REUSE_WEB_SERVER=true PARITY_REUSE_MOBILE_SERVER=true pnpm parity:capture
```

If mobile is slow to boot/load (especially Expo Go cold start), increase capture wait:
```bash
PARITY_SCREENSHOT_WAIT_SECONDS=150 pnpm parity:capture
```

Mobile capture waits for seeded parity content by default (`Burger Night` / `Spaghetti Carbonara`).
If your dataset differs, override the ready regex:
```bash
PARITY_SCREENSHOT_READY_PATTERN='Weekly Plan|Dinners' pnpm parity:capture
```

If deep-link routing is flaky, capture also taps the target bottom tab as a fallback before screenshot.

To adjust web capture framing without code changes:
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

## Useful commands
Reset DB with parity dataset only:
```bash
pnpm db:reset:parity
```

Capture one mobile screen directly:
```bash
scripts/parity/capture-mobile-screen.sh plan
```
