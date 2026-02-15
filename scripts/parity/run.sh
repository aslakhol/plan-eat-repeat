#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
screens=(plan dinners)
expo_port="${PARITY_EXPO_PORT:-8081}"
web_port="${PARITY_WEB_PORT:-3000}"
host_loopback="${PARITY_HOST_LOOPBACK:-localhost}"

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

export NEXT_PUBLIC_PARITY_BYPASS_TOKEN="${NEXT_PUBLIC_PARITY_BYPASS_TOKEN:-parity-capture}"
export PARITY_WEB_PORT="$web_port"

echo "Running parity capture against currently running dev servers."

mkdir -p "$root_dir/parity/web" "$root_dir/parity/mobile" "$root_dir/parity/side-by-side"

if ! curl --fail --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/parity/plan" >/dev/null 2>&1; then
  echo "Web parity route is not reachable on http://${host_loopback}:${web_port}/parity/plan."
  echo "Start it in another terminal:"
  echo "  pnpm dev:web:parity"
  echo "If you use a different web port, set PARITY_WEB_PORT before running parity:capture."
  exit 1
fi

if ! curl --fail --silent --output /dev/null --max-time 2 "http://${host_loopback}:${expo_port}" >/dev/null 2>&1; then
  echo "Mobile dev server is not reachable on http://${host_loopback}:${expo_port}."
  echo "Start it in another terminal:"
  echo "  pnpm dev:mobile:simulator"
  echo "or"
  echo "  pnpm dev:mobile:expo-go"
  echo "If you use a different Expo port, set PARITY_EXPO_PORT before running parity:capture."
  exit 1
fi

echo "Capturing web parity screenshots with Playwright..."
PARITY_WEB_PORT="${web_port}" pnpm --filter @planeatrepeat/web parity:capture

for screen in "${screens[@]}"; do
  echo "Capturing mobile screen '$screen'..."
  "$script_dir/capture-mobile-screen.sh" "$screen" "$root_dir/parity/mobile/${screen}.png"

  echo "Composing side-by-side image for '$screen'..."
  "$script_dir/compare.sh" \
    "$root_dir/parity/web/${screen}.png" \
    "$root_dir/parity/mobile/${screen}.png" \
    "$screen"
done

echo "Parity capture complete."
