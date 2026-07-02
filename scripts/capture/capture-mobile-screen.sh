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
output_path="${2:-$root_dir/capture/mobile/${screen_name}.png}"
expo_port=8081
web_port=3000
max_wait_seconds=90
reopen_every_seconds=12

find_online_device() {
  adb devices | awk 'NR > 1 && $2 == "device" { print $1; exit }'
}

device_serial="$(find_online_device || true)"
if [ -z "$device_serial" ]; then
  if ! command -v emulator >/dev/null 2>&1; then
    echo "No connected Android device and emulator binary not found."
    exit 1
  fi

  avd_name="$(emulator -list-avds | head -n 1)"
  if [ -z "$avd_name" ]; then
    echo "No Android AVD found. Create one in Android Studio first."
    exit 1
  fi

  echo "Starting Android emulator '$avd_name'..."
  emulator -avd "$avd_name" -no-snapshot-load -no-boot-anim >/tmp/capture-emulator.log 2>&1 &

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
"${adb_cmd[@]}" reverse "tcp:${web_port}" "tcp:${web_port}" >/dev/null 2>&1 || true

target_package=""
deep_link_url=""
if [ "$has_dev_build" -gt 0 ]; then
  deep_link_url="planeatrepeat://${screen_name}"
  target_package="com.planeatrepeat.mobile"
elif [ "$has_expo_go" -gt 0 ]; then
  "${adb_cmd[@]}" reverse "tcp:${expo_port}" "tcp:${expo_port}" >/dev/null 2>&1 || true
  deep_link_url="exp://127.0.0.1:${expo_port}/--/${screen_name}"
  target_package="host.exp.exponent"
else
  echo "No compatible mobile app found on '$device_serial'."
  echo "Install either:"
  echo "  1) com.planeatrepeat.mobile (dev build), or"
  echo "  2) Expo Go (host.exp.exponent), then run:"
  echo "     pnpm dev:mobile"
  exit 1
fi

open_target_screen() {
  echo "Opening ${deep_link_url} in ${target_package} on '$device_serial'..."
  "${adb_cmd[@]}" shell am start \
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

ready_marker=""
fallback_patterns=()
case "$screen_name" in
  plan)
    ready_marker="capture-ready-plan"
    fallback_patterns=("Weekly Plan")
    ;;
  dinners)
    ready_marker="capture-ready-dinners"
    fallback_patterns=("Dinners" "Add new dinner")
    ;;
esac

is_auth_screen() {
  local ui_xml="$1"

  if printf "%s" "$ui_xml" | grep -Fq "local login"; then
    return 0
  fi

  if printf "%s" "$ui_xml" | grep -Fq "Continue with Google"; then
    return 0
  fi

  return 1
}

screen_is_ready() {
  local ui_xml="$1"

  if [ -n "$ready_marker" ] && printf "%s" "$ui_xml" | grep -Fq "$ready_marker"; then
    return 0
  fi

  for marker in "${fallback_patterns[@]}"; do
    if ! printf "%s" "$ui_xml" | grep -Fq "$marker"; then
      return 1
    fi
  done

  return 0
}

wait_for_screen_ready() {
  "${adb_cmd[@]}" shell rm -f /sdcard/capture-ui.xml >/dev/null 2>&1 || true

  for second in $(seq 1 "$max_wait_seconds"); do
    if [ "$second" -eq 1 ] || [ $(( second % reopen_every_seconds )) -eq 0 ]; then
      open_target_screen
      # Deep-links can be flaky in Expo Go/dev builds; force the tab as fallback.
      focus_target_tab
    fi

    ui_xml=""
    if "${adb_cmd[@]}" shell uiautomator dump /sdcard/capture-ui.xml >/dev/null 2>&1; then
      ui_xml="$("${adb_cmd[@]}" shell cat /sdcard/capture-ui.xml 2>/dev/null | tr -d '\r' || true)"
    fi

    if is_auth_screen "$ui_xml"; then
      echo "Mobile app is still signed out."
      echo "Open the app, tap 'local login', and run 'pnpm capture' again."
      return 2
    fi

    if screen_is_ready "$ui_xml"; then
      return 0
    fi

    sleep 1
  done

  return 1
}

if wait_for_screen_ready; then
  :
else
  status=$?
  if [ "$status" -eq 2 ]; then
    exit 1
  fi

  echo "Timed out waiting for '${screen_name}' screen to render."
  echo "Expected capture marker '${ready_marker}' or fallback: ${fallback_patterns[*]}"
  exit 1
fi

sleep 1

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ADB_SERIAL="$device_serial" "$script_dir/capture-android.sh" "$output_path"

echo "Saved mobile screenshot to $output_path"
