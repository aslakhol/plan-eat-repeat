# Capture Workflow (Web + Android)

This workflow captures screenshots for `plan` and `dinners` from web and mobile,
then composes side-by-side images.

## Prereqs
- `pnpm`, `adb`, and ImageMagick (`magick`) installed.
- Android emulator/device available.
- One mobile runtime installed on the emulator/device:
  - `com.planeatrepeat.mobile` (dev build), or
  - Expo Go (`host.exp.exponent`).
- Playwright browser installed once:
```bash
pnpm --filter @planeatrepeat/web exec playwright install chromium
```

## Commands
Start servers in separate terminals:
```bash
pnpm dev:web
pnpm dev:mobile
```

Before capture, log in on mobile once by tapping `local login`.

Run capture:
```bash
pnpm capture
```

## Outputs
- `capture/web/plan.png`
- `capture/web/dinners.png`
- `capture/mobile/plan.png`
- `capture/mobile/dinners.png`
- `capture/side-by-side/plan.png`
- `capture/side-by-side/dinners.png`
