#!/bin/bash

set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
INSTALLER="$HERE/.."
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT

APP="$ROOT/app/Kittycord Installer.app"
LAUNCHER="$APP/Contents/MacOS/KittycordInstaller"

pass=0; fail=0
check()       { if [ "$2" = "$3" ]; then echo "PASS  $1"; pass=$((pass+1)); else echo "FAIL  $1 (got [$2], want [$3])"; fail=$((fail+1)); fi; }
checkfile()   { if [ -e "$1" ]; then echo "PASS  exists: $1"; pass=$((pass+1)); else echo "FAIL  missing: $1"; fail=$((fail+1)); fi; }
checknofile() { if [ ! -e "$1" ]; then echo "PASS  absent: $1"; pass=$((pass+1)); else echo "FAIL  present: $1"; fail=$((fail+1)); fi; }
grepok()      { if grep -q "$2" "$1"; then echo "PASS  $3"; pass=$((pass+1)); else echo "FAIL  $3"; fail=$((fail+1)); fi; }
ok()          { echo "PASS  $1"; pass=$((pass+1)); }
no()          { echo "FAIL  $1"; fail=$((fail+1)); }

echo "== syntax =="
bash -n "$INSTALLER/macos/KittycordInstaller" && ok "launcher syntax" || no "launcher syntax"
if command -v osacompile >/dev/null 2>&1; then
    osacompile -o "$ROOT/dialogs.scpt" "$INSTALLER/macos/dialogs.applescript" && ok "dialogs compile" || no "dialogs compile"
else
    echo "SKIP  osacompile not available"
fi

echo "== bundle =="
python3 "$INSTALLER/build-macos-app.py" --installer-dir "$INSTALLER" --out "$ROOT/Kittycord-Installer-macOS.zip" >/dev/null \
    && ok "bundle builds" || no "bundle builds"
mkdir -p "$ROOT/app"
unzip -q "$ROOT/Kittycord-Installer-macOS.zip" -d "$ROOT/app"
checkfile "$APP/Contents/Info.plist"
checkfile "$APP/Contents/PkgInfo"
checkfile "$APP/Contents/Resources/Kittycord.icns"
checkfile "$APP/Contents/Resources/dialogs.applescript"
checkfile "$APP/Contents/Resources/Kittycord-Install-macOS.command"
if [ -x "$LAUNCHER" ]; then ok "launcher keeps its executable bit"; else no "launcher keeps its executable bit"; fi
if [ -x "$APP/Contents/Resources/Kittycord-Install-macOS.command" ]; then ok "command keeps its executable bit"; else no "command keeps its executable bit"; fi
if command -v plutil >/dev/null 2>&1; then
    plutil -lint "$APP/Contents/Info.plist" >/dev/null && ok "Info.plist is valid" || no "Info.plist is valid"
fi
if command -v sips >/dev/null 2>&1; then
    sips -g pixelWidth "$APP/Contents/Resources/Kittycord.icns" >/dev/null 2>&1 && ok "macOS reads the icon" || no "macOS reads the icon"
fi

BIN="$ROOT/bin"
APPS="$ROOT/apps"
DATA="$ROOT/data"
mkdir -p "$BIN" "$APPS" "$DATA"
printf 'KITTYCORD_BUILD' > "$ROOT/desktop.asar"

stub_osascript() {
    cat > "$BIN/osascript" <<STUB
#!/bin/bash
case "\$2" in
    action) echo "$1" ;;
    targets) shift 3; for n in "\$@"; do echo "\$n"; done ;;
    code) echo "${2-}" ;;
    failed) echo "Close" ;;
esac
exit 0
STUB
    chmod +x "$BIN/osascript"
}

stub_open() {
    cat > "$BIN/open" <<STUB
#!/bin/bash
echo "\$*" >> "$ROOT/open.trace"
STUB
    chmod +x "$BIN/open"
}

fixtures() {
    rm -rf "$APPS"
    for name in "Discord" "Discord PTB"; do
        mkdir -p "$APPS/$name.app/Contents/Resources"
        printf 'VANILLA_ASAR_CONTENT' > "$APPS/$name.app/Contents/Resources/app.asar"
    done
}

launch() {
    PATH="$BIN:$PATH" KC_APP_BASES="$APPS" KC_SKIP_QUIT=1 KC_DATA_DIR="$DATA" \
        KC_ASAR_SOURCE="$ROOT/desktop.asar" TMPDIR="$ROOT" bash "$LAUNCHER" >/dev/null 2>&1
}

stub_open

echo "== install patches every picked Discord =="
fixtures
stub_osascript "Install or repair"
launch
check "install exits 0" "$?" "0"
checkfile "$APPS/Discord.app/Contents/Resources/_app.asar"
checkfile "$APPS/Discord PTB.app/Contents/Resources/_app.asar"
grepok "$APPS/Discord.app/Contents/Resources/app/index.js" "require(\"$DATA/desktop.asar\")" "stable got the shim"
grepok "$APPS/Discord PTB.app/Contents/Resources/app/index.js" "require(\"$DATA/desktop.asar\")" "ptb got the shim"

echo "== creator code reaches the installer =="
stub_osascript "Install or repair" "MyCode_1"
launch
check "referral lowercased" "$(cat "$DATA/referral.json" 2>/dev/null)" '{"code":"mycode_1"}'

echo "== uninstall restores vanilla =="
stub_osascript "Uninstall"
launch
check "uninstall exits 0" "$?" "0"
checkfile "$APPS/Discord.app/Contents/Resources/app.asar"
checknofile "$APPS/Discord.app/Contents/Resources/_app.asar"
check "restored asar vanilla" "$(cat "$APPS/Discord.app/Contents/Resources/app.asar")" "VANILLA_ASAR_CONTENT"

echo "== no Discord is reported, not patched =="
rm -rf "$APPS"; mkdir -p "$APPS"
stub_osascript "Install or repair"
launch
check "missing Discord exits 1" "$?" "1"

echo "== cancelling closes the app quietly =="
fixtures
rm -f "$ROOT/open.trace"
cat > "$BIN/osascript" <<'STUB'
#!/bin/bash
echo "0:69: execution error: User canceled. (-128)" >&2
exit 1
STUB
chmod +x "$BIN/osascript"
launch
check "cancel exits 0" "$?" "0"
checknofile "$APPS/Discord.app/Contents/Resources/_app.asar"
checknofile "$ROOT/open.trace"

echo "== a broken dialog falls back to Terminal =="
cat > "$BIN/osascript" <<'STUB'
#!/bin/bash
echo "dialogs are unavailable" >&2
exit 1
STUB
chmod +x "$BIN/osascript"
launch
check "fallback exits 0" "$?" "0"
grepok "$ROOT/open.trace" "Terminal" "Terminal fallback was used"

echo ""
echo "$pass passed, $fail failed"
[ "$fail" = "0" ]
