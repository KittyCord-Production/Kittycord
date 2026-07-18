#!/bin/bash
#
# Exercises Kittycord-Install-macOS.command against a throwaway Discord fixture.
# No network and no real Discord: KC_ASAR_SOURCE feeds a dummy build and
# KC_RESOURCES_DIR / KC_DATA_DIR redirect all writes into a temp dir.

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/../Kittycord-Install-macOS.command"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

pass=0; fail=0
check()       { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got [$2], want [$3])"; fail=$((fail+1)); fi; }
checkfile()   { if [ -e "$1" ]; then echo "PASS  exists: $1"; pass=$((pass+1)); else echo "FAIL  missing: $1"; fail=$((fail+1)); fi; }
checknofile() { if [ ! -e "$1" ]; then echo "PASS  absent: $1"; pass=$((pass+1)); else echo "FAIL  present: $1"; fail=$((fail+1)); fi; }
grepok()      { if grep -q "$2" "$1"; then echo "PASS  $3"; pass=$((pass+1)); else echo "FAIL  $3"; fail=$((fail+1)); fi; }

RES="$ROOT/Discord.app/Contents/Resources"
DATA="$ROOT/data"
SRC="$ROOT/desktop.asar"
mkdir -p "$RES"
printf 'VANILLA_ASAR_CONTENT' > "$RES/app.asar"
printf 'KITTYCORD_BUILD' > "$SRC"

run() { KC_ACTION="$1" KC_RESOURCES_DIR="$RES" KC_ASAR_SOURCE="$SRC" KC_DATA_DIR="$DATA" KC_SKIP_QUIT=1 KC_CREATOR_CODE="${2-}" bash "$SCRIPT" >/dev/null 2>&1; }

echo "== syntax =="
bash -n "$SCRIPT" && { echo "PASS  syntax"; pass=$((pass+1)); } || { echo "FAIL  syntax"; fail=$((fail+1)); }

echo "== fresh install =="
run install
checkfile "$RES/_app.asar"
checkfile "$RES/app/index.js"
checkfile "$RES/app/package.json"
checknofile "$RES/app.asar"
check "backup holds vanilla" "$(cat "$RES/_app.asar")" "VANILLA_ASAR_CONTENT"
check "asar cached" "$(cat "$DATA/desktop.asar")" "KITTYCORD_BUILD"
grepok "$RES/app/index.js" "require(\"$DATA/desktop.asar\")" "index requires cached asar"
grepok "$RES/app/index.js" 'require("../_app.asar")' "index has vanilla fallback"
grepok "$RES/app/package.json" '"main": "index.js"' "package.json main"

echo "== repair is idempotent =="
run install
check "backup still vanilla" "$(cat "$RES/_app.asar")" "VANILLA_ASAR_CONTENT"
checknofile "$RES/app.asar"

echo "== creator code =="
run install "MyCode_1"
check "referral lowercased" "$(cat "$DATA/referral.json")" '{"code":"mycode_1"}'
rm -f "$DATA/referral.json"
run install "!!"
checknofile "$DATA/referral.json"

echo "== uninstall restores vanilla =="
run uninstall
checkfile "$RES/app.asar"
checknofile "$RES/_app.asar"
checknofile "$RES/app"
check "restored asar vanilla" "$(cat "$RES/app.asar")" "VANILLA_ASAR_CONTENT"

echo "== take over a foreign-mod install =="
rm -rf "$RES/app" "$RES/app.asar"
printf 'VANILLA_ASAR_CONTENT' > "$RES/_app.asar"
mkdir -p "$RES/app"; printf 'OTHER_MOD' > "$RES/app/index.js"
run install
check "reused vanilla backup" "$(cat "$RES/_app.asar")" "VANILLA_ASAR_CONTENT"
grepok "$RES/app/index.js" "require(\"$DATA/desktop.asar\")" "our shim took over"

echo ""
echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
