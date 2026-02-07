#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: compare.sh <web.png> <mobile.png> <name>"
  echo "Example: compare.sh parity/web/plan.png parity/mobile/plan.png plan"
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
parity_dir="$root_dir/parity"
side_dir="$parity_dir/side-by-side"
mkdir -p "$side_dir"

web_size="$(magick identify -format '%wx%h' "$web_path")"
mobile_size="$(magick identify -format '%wx%h' "$mobile_path")"

side_path="$side_dir/${name}.png"

magick montage "$web_path" "$mobile_path" -tile 2x1 -geometry +12+0 "$side_path"

echo "Side-by-side: $side_path"
