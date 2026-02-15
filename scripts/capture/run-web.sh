#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
screens=(plan dinners)
web_port=3000
host_loopback="localhost"
skip_sbs=false

case "${1:-}" in
  "" ) ;;
  "--skip-sbs") skip_sbs=true ;;
  "--help"|"-h")
    echo "Usage: run-web.sh [--skip-sbs]"
    exit 0
    ;;
  *)
    echo "Unknown argument: ${1}"
    echo "Usage: run-web.sh [--skip-sbs]"
    exit 1
    ;;
esac

if [ "$#" -gt 1 ]; then
  echo "Usage: run-web.sh [--skip-sbs]"
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required but not found on PATH."
  exit 1
fi

if [ "$skip_sbs" = false ] && ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) is required but not found on PATH."
  exit 1
fi

mkdir -p "$root_dir/capture/web" "$root_dir/capture/mobile" "$root_dir/capture/side-by-side"

if ! curl --fail --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/api/health" >/dev/null 2>&1; then
  echo "Web server is not reachable on http://${host_loopback}:${web_port}/api/health."
  echo "Start it in another terminal:"
  echo "  pnpm dev:web"
  exit 1
fi

echo "Capturing web screenshots with Playwright..."
pnpm --filter @planeatrepeat/web capture

if [ "$skip_sbs" = true ]; then
  echo "Web capture complete."
  exit 0
fi

for screen in "${screens[@]}"; do
  mobile_image="$root_dir/capture/mobile/${screen}.png"
  if [ ! -f "$mobile_image" ]; then
    echo "Mobile screenshot is missing: $mobile_image"
    echo "Run one of the following first:"
    echo "  pnpm capture:mobile"
    echo "  pnpm capture"
    exit 1
  fi

  echo "Composing side-by-side image for '$screen'..."
  "$script_dir/compare.sh" \
    "$root_dir/capture/web/${screen}.png" \
    "$mobile_image" \
    "$screen"
done

echo "Web capture complete."
