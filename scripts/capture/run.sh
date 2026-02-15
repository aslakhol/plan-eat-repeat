#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
screens=(plan dinners)
expo_port=8081
web_port=3000
host_loopback="localhost"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: run.sh"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not found on PATH."
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb is required but not found on PATH."
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required but not found on PATH."
  exit 1
fi

echo "Running capture against currently running dev servers."

mkdir -p "$root_dir/capture/web" "$root_dir/capture/mobile" "$root_dir/capture/side-by-side"

if ! curl --fail --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/api/health" >/dev/null 2>&1; then
  echo "Web server is not reachable on http://${host_loopback}:${web_port}/api/health."
  echo "Start it in another terminal:"
  echo "  pnpm dev:web"
  exit 1
fi

if ! curl --fail --silent --output /dev/null --max-time 2 "http://${host_loopback}:${expo_port}" >/dev/null 2>&1; then
  echo "Mobile dev server is not reachable on http://${host_loopback}:${expo_port}."
  echo "Start it in another terminal:"
  echo "  pnpm dev:mobile"
  exit 1
fi

echo "Capturing web screenshots with Playwright..."
pnpm --filter @planeatrepeat/web capture

for screen in "${screens[@]}"; do
  echo "Capturing mobile screen '$screen'..."
  "$script_dir/capture-mobile-screen.sh" "$screen" "$root_dir/capture/mobile/${screen}.png"

  echo "Composing side-by-side image for '$screen'..."
  "$script_dir/compare.sh" \
    "$root_dir/capture/web/${screen}.png" \
    "$root_dir/capture/mobile/${screen}.png" \
    "$screen"
done

echo "Capture complete."
