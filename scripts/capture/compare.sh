#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: compare.sh <web.png> <mobile.png> <name>"
  echo "Example: compare.sh capture/web/plan.png capture/mobile/plan.png plan"
  exit 1
fi

web_path="$1"
mobile_path="$2"
name="$3"

if [ ! -f "$web_path" ]; then
  echo "Web image not found: $web_path"
  exit 1
fi
if [ ! -f "$mobile_path" ]; then
  echo "Mobile image not found: $mobile_path"
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick (magick) not found. Install via Homebrew: brew install imagemagick"
  exit 1
fi

root_dir="$(git rev-parse --show-toplevel)"
capture_dir="$root_dir/capture"
side_dir="$capture_dir/side-by-side"
mkdir -p "$side_dir"

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT

mobile_width="$(magick identify -format '%w' "$mobile_path")"
mobile_height="$(magick identify -format '%h' "$mobile_path")"

normalized_web_path="$temp_dir/web-normalized.png"
normalized_mobile_path="$temp_dir/mobile-normalized.png"

magick "$web_path" \
  -resize "${mobile_width}x${mobile_height}" \
  -background white \
  -gravity center \
  -extent "${mobile_width}x${mobile_height}" \
  "$normalized_web_path"

magick "$mobile_path" \
  -resize "${mobile_width}x${mobile_height}" \
  -background white \
  -gravity center \
  -extent "${mobile_width}x${mobile_height}" \
  "$normalized_mobile_path"

side_path="$side_dir/${name}.png"

magick "$normalized_web_path" "$normalized_mobile_path" +append "$side_path"

echo "Side-by-side: $side_path"
