#!/usr/bin/env bash
set -euo pipefail

root_dir="$(git rev-parse --show-toplevel)"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
screens=(plan dinners)
expo_port="${PARITY_EXPO_PORT:-8081}"
web_port="${PARITY_WEB_PORT:-3100}"
host_loopback="${PARITY_HOST_LOOPBACK:-localhost}"
reuse_web_server="${PARITY_REUSE_WEB_SERVER:-false}"
reuse_mobile_server="${PARITY_REUSE_MOBILE_SERVER:-false}"
started_mobile_server="false"
mobile_server_pid=""
started_web_server="false"
web_server_pid=""

cleanup() {
  if [ "$started_mobile_server" = "true" ] && [ -n "$mobile_server_pid" ]; then
    kill "$mobile_server_pid" >/dev/null 2>&1 || true
  fi
  if [ "$started_web_server" = "true" ] && [ -n "$web_server_pid" ]; then
    kill "$web_server_pid" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

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

export PARITY_BYPASS_AUTH="true"
export NEXT_PUBLIC_PARITY_BYPASS_TOKEN="${NEXT_PUBLIC_PARITY_BYPASS_TOKEN:-parity-capture}"
export PARITY_WEB_PORT="$web_port"

echo "Running parity capture against current development data (no DB reset)."

mkdir -p "$root_dir/parity/web" "$root_dir/parity/mobile" "$root_dir/parity/side-by-side"

echo "Capturing web parity screenshots with Playwright..."
pnpm --filter @planeatrepeat/web parity:capture

if ! curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/parity/plan" >/dev/null 2>&1; then
  echo "Starting web parity server on port ${web_port} for mobile API calls..."
  PARITY_BYPASS_AUTH="true" \
    NEXT_PUBLIC_PARITY_BYPASS_TOKEN="$NEXT_PUBLIC_PARITY_BYPASS_TOKEN" \
    pnpm --filter @planeatrepeat/web exec next dev -H localhost -p "${web_port}" > /tmp/parity-web-dev.log 2>&1 &
  web_server_pid="$!"
  started_web_server="true"

  echo "Waiting for web parity server to become ready..."
  for _ in $(seq 1 180); do
    if curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/parity/plan" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done

  if ! curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${web_port}/parity/plan" >/dev/null 2>&1; then
    echo "Web parity server did not become ready on port ${web_port}."
    echo "Check /tmp/parity-web-dev.log for details."
    exit 1
  fi
else
  if [ "$reuse_web_server" = "true" ]; then
    echo "Using existing web server on port ${web_port} for mobile API calls."
  else
    echo "A web server is already running on port ${web_port}."
    echo "Stop it for deterministic parity runs, or set PARITY_REUSE_WEB_SERVER=true to reuse it."
    exit 1
  fi
fi

if [ "${PARITY_START_MOBILE_SERVER:-true}" = "true" ]; then
  if ! curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${expo_port}" >/dev/null 2>&1; then
    echo "Starting mobile dev server for parity on port ${expo_port}..."
    EXPO_PUBLIC_PARITY_BYPASS_AUTH="true" \
      EXPO_PUBLIC_PARITY_API_URL="http://127.0.0.1:${web_port}" \
      EXPO_PUBLIC_PARITY_API_PORT="${web_port}" \
      pnpm dev:mobile:parity > /tmp/parity-mobile-dev.log 2>&1 &
    mobile_server_pid="$!"
    started_mobile_server="true"

    echo "Waiting for mobile dev server to become ready..."
    for _ in $(seq 1 180); do
      if curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${expo_port}" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    if ! curl --silent --output /dev/null --max-time 2 "http://${host_loopback}:${expo_port}" >/dev/null 2>&1; then
      echo "Mobile dev server did not become ready on port ${expo_port}."
      echo "Check /tmp/parity-mobile-dev.log for details."
      exit 1
    fi
  else
    if [ "$reuse_mobile_server" = "true" ]; then
      echo "Using existing mobile dev server on port ${expo_port}."
    else
      echo "A mobile dev server is already running on port ${expo_port}."
      echo "Stop it for deterministic parity runs, or set PARITY_REUSE_MOBILE_SERVER=true to reuse it."
      exit 1
    fi
  fi
fi

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
