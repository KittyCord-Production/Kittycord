/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Discord's in-game overlay runs the full client renderer in a separate, transparent window.
// Kittycord must never inject themes or managed styles there, or the overlay turns opaque and
// covers the game. This mirrors Discord's own overlay detection (discord_overlay2/index.js):
// the `__OVERLAY__` global, the `__OVERLAY__SENTINEL__` node, or "overlay" in the path. The
// substring (not `/overlay`) is what catches the renderer URLs `.../discord_overlay/...` and
// `.../discord_overlay2/start.html`, where the global isn't set yet when styles first inject.

export function isOverlayContext(win: Window | undefined) {
    try {
        if ((win as any)?.__OVERLAY__) return true;
        if (win?.document?.getElementById?.("__OVERLAY__SENTINEL__")) return true;
        const { pathname = "", href = "" } = win?.location ?? {};
        return /overlay/i.test(pathname) || /overlay/i.test(href);
    } catch {
        return false;
    }
}

export function isOverlayWindow() {
    return isOverlayContext(window);
}
