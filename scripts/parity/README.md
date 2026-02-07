# Parity Screenshot Workflow (Web vs Mobile)

This workflow captures screenshots for the same screen in web and mobile, then produces a side-by-side image to quickly spot visual gaps.

## Prereqs
- Android phone connected via USB with USB debugging enabled.
- `adb` available on PATH.
- ImageMagick (`magick`) installed.

## Capture Android screenshot
1. Navigate the phone to the screen you want (e.g., Plan).
2. Run:

```bash
scripts/parity/capture-android.sh parity/mobile/plan.png
```

## Capture Web screenshot
1. Open the same screen in the browser.
2. Take a screenshot and save it to `parity/web/plan.png`.

## Compare
```bash
scripts/parity/compare.sh parity/web/plan.png parity/mobile/plan.png plan
```

Outputs:
- `parity/side-by-side/plan.png`

## Notes
- This is intentionally simple and manual so it’s easy to repeat.
- When implementing fixes, review both the screenshots and the corresponding code. Screenshots show visual gaps quickly, but code inspection is needed to understand why the difference exists.

## Future Improvements
- Add Playwright to capture web screenshots automatically for known routes.
- Use a simulator/emulator so mobile screenshots can be captured without navigating on a physical phone.
