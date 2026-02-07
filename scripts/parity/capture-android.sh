#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: capture-android.sh <output.png>"
  exit 1
fi

output_path="$1"
output_dir="$(dirname "$output_path")"
mkdir -p "$output_dir"

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android platform-tools and ensure adb is on PATH."
  exit 1
fi

state="$(adb get-state 2>/dev/null || true)"
if [ "$state" != "device" ]; then
  echo "No Android device detected. Ensure USB debugging is enabled and the device is connected."
  adb devices || true
  exit 1
fi

adb exec-out screencap -p > "$output_path"

if [ ! -s "$output_path" ]; then
  echo "Screenshot failed or produced empty file: $output_path"
  exit 1
fi

echo "Saved Android screenshot to $output_path"
