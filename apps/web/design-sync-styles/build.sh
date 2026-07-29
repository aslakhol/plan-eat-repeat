#!/bin/sh
# Compiles the static stylesheet that ships with the design-system upload.
# Run from the repo root before the design-sync converter.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
node "$here/gen-candidates.mjs"
npx tailwindcss -c "$here/tailwind.config.cjs" -i "$here/input.css" -o "$here/ds.css" --minify
