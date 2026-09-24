#!/bin/bash
#
# Exercises the installer on Linux against throwaway Discord fixtures laid out
# like the official .tar.gz (/opt/Discord) and .deb (/usr/share/discord-ptb).
# No network and no real Discord.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../Kittycord-Install-macOS.command"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got [$2], want [$3])"; fail=$((fail+1)); fi; }

TAR="$ROOT/opt/Discord/resources"
DEB="$ROOT/usr/share/discord-ptb/resources"
mkdir -p "$TAR" "$DEB"
printf 'VANILLA' > "$TAR/app.asar"
printf 'VANILLA' > "$DEB/app.asar"
printf 'KITTYCORD_BUILD' > "$ROOT/desktop.asar"
DATA="$ROOT/data"
BASES="$ROOT/opt:$ROOT/usr/share:$ROOT/missing"

found="$(KC_LIST_TARGETS=1 KC_APP_BASES="$BASES" bash "$SCRIPT")"
check "finds the tarball install" "$(printf '%s\n' "$found" | grep -c "^Discord	$TAR$")" "1"
check "finds the deb install" "$(printf '%s\n' "$found" | grep -c "^Discord PTB	$DEB$")" "1"

KC_ACTION=install KC_RESOURCES_DIR="$TAR" KC_ASAR_SOURCE="$ROOT/desktop.asar" KC_DATA_DIR="$DATA" KC_SKIP_QUIT=1 KC_CREATOR_CODE= bash "$SCRIPT" >/dev/null 2>&1
check "install exits 0" "$?" "0"
check "vanilla backed up" "$(cat "$TAR/_app.asar")" "VANILLA"
check "shim loads the build" "$(grep -c "require(\"$DATA/desktop.asar\")" "$TAR/app/index.js")" "1"
check "build cached" "$(cat "$DATA/desktop.asar")" "KITTYCORD_BUILD"

KC_ACTION=uninstall KC_RESOURCES_DIR="$TAR" KC_DATA_DIR="$DATA" KC_SKIP_QUIT=1 bash "$SCRIPT" >/dev/null 2>&1
check "uninstall restores vanilla" "$(cat "$TAR/app.asar")" "VANILLA"
check "shim removed" "$([ -e "$TAR/app" ] && echo yes || echo no)" "no"

out="$(KC_ACTION=install KC_APP_BASES="$ROOT/missing" KC_ASAR_SOURCE="$ROOT/desktop.asar" KC_DATA_DIR="$DATA" KC_SKIP_QUIT=1 KC_CREATOR_CODE= bash "$SCRIPT" 2>&1)" && rc=0 || rc=$?
check "no Discord exits 1" "$rc" "1"
case "$out" in *"Flatpak"*) echo "PASS  Linux hint shown"; pass=$((pass+1));; *) echo "FAIL  Linux hint shown"; fail=$((fail+1));; esac

echo ""
echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
