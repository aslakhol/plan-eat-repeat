#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: capture-mobile-screen.sh <plan|dinners> [output.png]"
  exit 1
fi

screen_name="$1"
case "$screen_name" in
  plan|dinners) ;;
  *)
    echo "Unsupported screen '$screen_name'. Use 'plan' or 'dinners'."
    exit 1
    ;;
esac

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android platform-tools and ensure adb is on PATH."
  exit 1
fi

root_dir="$(git rev-parse --show-toplevel)"
output_path="${2:-$root_dir/parity/mobile/${screen_name}.png}"
expo_port="${PARITY_EXPO_PORT:-8081}"
web_port="${PARITY_WEB_PORT:-3100}"
max_wait_seconds="${PARITY_SCREENSHOT_WAIT_SECONDS:-90}"
reopen_every_seconds="${PARITY_REOPEN_DEEPLINK_SECONDS:-12}"
if [ "$reopen_every_seconds" -le 0 ]; then
  reopen_every_seconds=12
fi

find_online_device() {
  adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }'
}

device_serial="$(find_online_device || true)"
if [ -z "$device_serial" ]; then
  if ! command -v emulator >/dev/null 2>&1; then
    echo "No connected Android device and emulator binary not found."
    exit 1
  fi

  avd_name="${PARITY_ANDROID_AVD:-$(emulator -list-avds | head -n 1)}"
  if [ -z "$avd_name" ]; then
    echo "No Android AVD found. Create one in Android Studio first."
    exit 1
  fi

  echo "Starting Android emulator '$avd_name'..."
  emulator -avd "$avd_name" -no-snapshot-load -no-boot-anim >/tmp/parity-emulator.log 2>&1 &

  echo "Waiting for emulator to come online..."
  for _ in $(seq 1 180); do
    device_serial="$(find_online_device || true)"
    if [ -n "$device_serial" ]; then
      break
    fi
    sleep 1
  done
fi

if [ -z "$device_serial" ]; then
  echo "No Android device became available."
  exit 1
fi

adb_cmd=(adb -s "$device_serial")

"${adb_cmd[@]}" wait-for-device
for _ in $(seq 1 120); do
  boot_completed="$("${adb_cmd[@]}" shell getprop sys.boot_completed | tr -d '\r')"
  if [ "$boot_completed" = "1" ]; then
    break
  fi
  sleep 1
done

has_dev_build="$("${adb_cmd[@]}" shell pm list packages com.planeatrepeat.mobile | grep -c "com.planeatrepeat.mobile" || true)"
has_expo_go="$("${adb_cmd[@]}" shell pm list packages host.exp.exponent | grep -c "host.exp.exponent" || true)"

"${adb_cmd[@]}" shell input keyevent KEYCODE_WAKEUP || true
"${adb_cmd[@]}" shell wm dismiss-keyguard || true
# Route device localhost web API calls to host machine for parity.
"${adb_cmd[@]}" reverse "tcp:${web_port}" "tcp:${web_port}" >/dev/null 2>&1 || true

target_package=""
deep_link_url=""
if [ "$has_dev_build" -gt 0 ]; then
  deep_link_url="planeatrepeat://${screen_name}"
  target_package="com.planeatrepeat.mobile"
elif [ "$has_expo_go" -gt 0 ]; then
  # Allow emulator/USB devices to access local Expo server via loopback.
  "${adb_cmd[@]}" reverse "tcp:${expo_port}" "tcp:${expo_port}" >/dev/null 2>&1 || true

  deep_link_url="${PARITY_EXPO_DEV_URL:-exp://127.0.0.1:${expo_port}/--/${screen_name}}"
  target_package="host.exp.exponent"
else
  echo "No compatible mobile app found on '$device_serial'."
  echo "Install either:"
  echo "  1) com.planeatrepeat.mobile (dev build), or"
  echo "  2) Expo Go (host.exp.exponent), then run:"
  echo "     pnpm dev:mobile:parity:android"
  exit 1
fi

open_target_screen() {
  echo "Opening ${deep_link_url} in ${target_package} on '$device_serial'..."
  "${adb_cmd[@]}" shell am start -W \
    -a android.intent.action.VIEW \
    -d "$deep_link_url" \
    "$target_package" >/dev/null
}

screen_size_raw="$("${adb_cmd[@]}" shell wm size | tr -d '\r' || true)"
size_token="$(printf "%s" "$screen_size_raw" | grep -Eo '[0-9]+x[0-9]+' | head -n 1)"
screen_width="${size_token%x*}"
screen_height="${size_token#*x}"
if [ -z "${screen_width:-}" ] || [ -z "${screen_height:-}" ]; then
  screen_width=1080
  screen_height=2400
fi
tab_y=$((screen_height * 94 / 100))
plan_tab_x=$((screen_width * 25 / 100))
dinners_tab_x=$((screen_width * 75 / 100))

focus_target_tab() {
  case "$screen_name" in
    plan)
      "${adb_cmd[@]}" shell input tap "$plan_tab_x" "$tab_y" >/dev/null 2>&1 || true
      ;;
    dinners)
      "${adb_cmd[@]}" shell input tap "$dinners_tab_x" "$tab_y" >/dev/null 2>&1 || true
      ;;
  esac
}

ready_pattern_override="${PARITY_SCREENSHOT_READY_PATTERN:-}"
required_patterns=()
case "$screen_name" in
  plan)
    # Require both shell and seeded content.
    required_patterns=("Weekly Plan" "Burger Night")
    ;;
  dinners)
    # Require dinners screen + seeded content.
    required_patterns=("Dinners" "Add new dinner" "Spaghetti Carbonara")
    ;;
esac

screen_is_ready() {
  local ui_xml="$1"
  if [ -n "$ready_pattern_override" ]; then
    printf "%s" "$ui_xml" | grep -Eq "$ready_pattern_override"
    return $?
  fi

  for marker in "${required_patterns[@]}"; do
    if ! printf "%s" "$ui_xml" | grep -Fq "$marker"; then
      return 1
    fi
  done
  return 0
}

wait_for_screen_ready() {
  "${adb_cmd[@]}" shell rm -f /sdcard/parity-ui.xml >/dev/null 2>&1 || true

  for second in $(seq 1 "$max_wait_seconds"); do
    ui_xml=""
    if "${adb_cmd[@]}" shell uiautomator dump /sdcard/parity-ui.xml >/dev/null 2>&1; then
      ui_xml="$("${adb_cmd[@]}" shell cat /sdcard/parity-ui.xml 2>/dev/null | tr -d '\r' || true)"
    fi

    if screen_is_ready "$ui_xml"; then
      return 0
    fi

    if [ "$second" -eq 1 ] || [ $(( second % reopen_every_seconds )) -eq 0 ]; then
      open_target_screen
      # Deep-links can be flaky in Expo Go/dev builds; force the tab as fallback.
      focus_target_tab
    fi

    sleep 1
  done

  return 1
}

if ! wait_for_screen_ready; then
  echo "Timed out waiting for '${screen_name}' screen to render."
  if [ -n "$ready_pattern_override" ]; then
    echo "Looked for text pattern: ${ready_pattern_override}"
  else
    echo "Missing required markers: ${required_patterns[*]}"
  fi
  echo "You can tune:"
  echo "  PARITY_SCREENSHOT_WAIT_SECONDS (default ${max_wait_seconds})"
  echo "  PARITY_SCREENSHOT_READY_PATTERN (regex)"
  echo "  PARITY_REOPEN_DEEPLINK_SECONDS (default ${reopen_every_seconds})"
  exit 1
fi

sleep "${PARITY_SCREENSHOT_DELAY_SECONDS:-1}"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADB_SERIAL="$device_serial" "$script_dir/capture-android.sh" "$output_path"

echo "Saved mobile screenshot to $output_path"
