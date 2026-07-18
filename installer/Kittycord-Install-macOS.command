#!/bin/bash
#
# Kittycord - macOS installer
#
# Downloads the latest Kittycord build (desktop.asar) and patches your installed
# Discord so it loads Kittycord. Works by double-click (right click > Open the
# first time, since it is not signed) or piped from curl.
#
#   sh -c "$(curl -fsSL https://github.com/KittyCord-Production/Kittycord/releases/latest/download/Kittycord-Install-macOS.command)"
#
# Run again any time to repair after a Discord update. Choose Uninstall to revert.

set -euo pipefail

REPO="KittyCord-Production/Kittycord"
ASAR_URL="https://github.com/$REPO/releases/latest/download/desktop.asar"
DATA_DIR="${KC_DATA_DIR:-$HOME/Library/Application Support/Kittycord}"
ASAR_PATH="$DATA_DIR/desktop.asar"

info() { printf '\033[36m%s\033[0m\n' "$*"; }
ok()   { printf '\033[32m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m%s\033[0m\n' "$*"; }
fail() { printf '\033[31m%s\033[0m\n' "$*" >&2; }

prompt() {
    local answer=""
    if [ -r /dev/tty ]; then
        printf '%s' "$1" > /dev/tty
        read -r answer < /dev/tty || answer=""
    fi
    printf '%s' "$answer"
}

APP_NAMES=("Discord" "Discord PTB" "Discord Canary")

discover_targets() {
    local base name res
    for base in "/Applications" "$HOME/Applications"; do
        for name in "${APP_NAMES[@]}"; do
            res="$base/$name.app/Contents/Resources"
            [ -d "$res" ] && printf '%s\t%s\n' "$name" "$res"
        done
    done
}

quit_discord() {
    local name="$1"
    [ "${KC_SKIP_QUIT:-0}" = "1" ] && return 0
    osascript -e "quit app \"$name\"" >/dev/null 2>&1 || true
    sleep 1
    pkill -x "$name" >/dev/null 2>&1 || true
    sleep 1
}

download_asar() {
    mkdir -p "$DATA_DIR"
    if [ -n "${KC_ASAR_SOURCE:-}" ]; then
        info "Using local build: $KC_ASAR_SOURCE"
        cp "$KC_ASAR_SOURCE" "$ASAR_PATH"
        return 0
    fi
    info "Downloading the latest Kittycord build..."
    if ! curl -fL "$ASAR_URL" -o "$ASAR_PATH"; then
        fail "Could not download the build from $ASAR_URL"
        fail "Make sure a release with a desktop.asar asset exists, then try again."
        exit 1
    fi
    local expected actual
    expected="$(curl -fsSL "$ASAR_URL.sha256" 2>/dev/null | tr -d '[:space:]' | tr 'A-F' 'a-f' || true)"
    if printf '%s' "$expected" | grep -Eq '^[0-9a-f]{64}$'; then
        actual="$(shasum -a 256 "$ASAR_PATH" | awk '{print $1}')"
        if [ "$actual" != "$expected" ]; then
            rm -f "$ASAR_PATH"
            fail "Checksum mismatch. The download may be corrupted, or a new release is publishing right now."
            fail "Please try again in a minute."
            exit 1
        fi
        ok "Checksum verified (SHA-256 OK)."
    else
        warn "No checksum published for this release, skipping verification."
    fi
}

patch_target() {
    local name="$1" res="$2"
    local asar="$res/app.asar" backup="$res/_app.asar" appdir="$res/app"

    if [ ! -w "$res" ]; then
        fail "No write access to $res"
        fail "Discord may be owned by another user. Re-run this installer with: sudo bash \"$0\""
        exit 1
    fi

    quit_discord "$name"

    if [ -f "$asar" ] && [ ! -e "$backup" ]; then
        mv "$asar" "$backup"
    fi
    if [ ! -e "$backup" ]; then
        warn "Could not find app.asar in $res, skipping $name."
        return 1
    fi

    rm -rf "$appdir"
    mkdir -p "$appdir"

    cat > "$appdir/package.json" <<'JSON'
{
    "name": "discord",
    "main": "index.js",
    "private": true
}
JSON

    cat > "$appdir/index.js" <<JS
try {
    require("$ASAR_PATH");
} catch (err) {
    console.error("[Kittycord] Failed to load, starting vanilla Discord:", err);
    require("../_app.asar");
}
JS

    ok "Patched $name."
    return 0
}

unpatch_target() {
    local name="$1" res="$2"
    local asar="$res/app.asar" backup="$res/_app.asar" appdir="$res/app"

    if [ ! -w "$res" ]; then
        fail "No write access to $res. Re-run this installer with: sudo bash \"$0\""
        exit 1
    fi

    quit_discord "$name"

    [ -d "$appdir" ] && rm -rf "$appdir"
    if [ -e "$backup" ]; then
        mv -f "$backup" "$asar"
        ok "Restored vanilla $name."
    else
        warn "$name was not patched, nothing to restore."
    fi
}

save_creator_code() {
    local code="${KC_CREATOR_CODE-__ask__}"
    if [ "$code" = "__ask__" ]; then
        code="$(prompt 'Creator code (press Enter to skip): ')"
    fi
    [ -z "$code" ] && return 0
    local lower
    lower="$(printf '%s' "$code" | tr 'A-Z' 'a-z')"
    if ! printf '%s' "$lower" | grep -Eq '^[a-z0-9_-]{3,20}$'; then
        warn "Creator code must be 3-20 letters, numbers, - or _. Skipping."
        return 0
    fi
    mkdir -p "$DATA_DIR"
    printf '{"code":"%s"}' "$lower" > "$DATA_DIR/referral.json"
    ok "Saved creator code."
}

resolve_targets() {
    if [ -n "${KC_RESOURCES_DIR:-}" ]; then
        printf '%s\t%s\n' "${KC_TARGET_NAME:-Discord}" "$KC_RESOURCES_DIR"
        return 0
    fi
    local found
    found="$(discover_targets)"
    if [ -z "$found" ]; then
        fail "No Discord installation was found in /Applications or ~/Applications."
        fail "Install Discord first, then run this again."
        exit 1
    fi
    local count
    count="$(printf '%s\n' "$found" | wc -l | tr -d ' ')"
    if [ "$count" = "1" ]; then
        printf '%s\n' "$found"
        return 0
    fi
    info "Multiple Discord installations found:" >&2
    local i=1 line
    while IFS=$'\t' read -r name res; do
        printf '  %s) %s  (%s)\n' "$i" "$name" "$res" >&2
        i=$((i + 1))
    done <<< "$found"
    local pick
    pick="$(prompt 'Patch which one? Enter a number (or "a" for all): ')"
    if [ "$pick" = "a" ] || [ "$pick" = "A" ]; then
        printf '%s\n' "$found"
        return 0
    fi
    if printf '%s' "$pick" | grep -Eq '^[0-9]+$' && [ "$pick" -ge 1 ] && [ "$pick" -le "$count" ]; then
        printf '%s\n' "$found" | sed -n "${pick}p"
        return 0
    fi
    fail "Invalid choice."
    exit 1
}

resolve_action() {
    local action="${KC_ACTION:-}"
    if [ -n "$action" ]; then
        printf '%s' "$action" | tr 'A-Z' 'a-z'
        return 0
    fi
    info "What would you like to do?" >&2
    printf '  1) Install or repair Kittycord\n  2) Uninstall\n' >&2
    local pick
    pick="$(prompt 'Enter a number [1]: ')"
    case "$pick" in
        2) printf 'uninstall' ;;
        *) printf 'install' ;;
    esac
}

main() {
    printf '\033[35m%s\033[0m\n' "Kittycord for macOS"

    local action targets
    action="$(resolve_action)"
    targets="$(resolve_targets)"

    case "$action" in
        install|repair)
            download_asar
            local patched=0 name res
            while IFS=$'\t' read -r name res; do
                [ -z "$name" ] && continue
                patch_target "$name" "$res" && patched=1
            done <<< "$targets"
            if [ "$patched" != "1" ]; then
                fail "Nothing was patched."
                exit 1
            fi
            save_creator_code
            printf '\033[35m%s\033[0m\n' "Kittycord installed. Start Discord again to see it."
            ;;
        uninstall)
            local name res
            while IFS=$'\t' read -r name res; do
                [ -z "$name" ] && continue
                unpatch_target "$name" "$res"
            done <<< "$targets"
            printf '\033[35m%s\033[0m\n' "Kittycord removed. Start Discord again for the vanilla client."
            ;;
        *)
            fail "Unknown action: $action"
            exit 1
            ;;
    esac
}

main
