#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: run.sh"
  exit 0
fi

if [ "$#" -gt 0 ]; then
  echo "Usage: run.sh"
  exit 1
fi

echo "Running capture against currently running dev servers."

"$script_dir/run-web.sh" --skip-sbs
"$script_dir/run-mobile.sh"

echo "Capture complete."
