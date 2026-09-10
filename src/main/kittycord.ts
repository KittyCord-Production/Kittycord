/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const MODULES = [
    ["the request log", () => require("./requestLog").installRequestLog()],
    ["the style seed", () => require("./styleSeed")],
    ["splash branding", () => require("./kittycordSplash")],
    ["the bundled themes", () => require("./bundledThemes")],
    ["usage stats", () => require("./telemetry")],
    ["crash reporting", () => require("./crashReporter")],
    ["deep links", () => require("./deepLinks")],
    ["the share registry", () => require("./shareRegistry")],
    ["custom badges", () => require("./customBadges")],
    ["build info", () => require("./buildInfo")]
] as const;

export function installKittycord() {
    for (const [what, load] of MODULES) {
        try {
            load();
        } catch (err) {
            console.error(`[Kittycord] Failed to set up ${what}`, err);
        }
    }

    if (IS_VESKTOP || IS_EQUIBOP) return;

    try {
        require("./hostUpdateHook").installHostUpdateHook();
    } catch (err) {
        console.error("[Kittycord] Failed to install the host update hook", err);
    }

    if (process.platform !== "win32") return;

    try {
        require("./persistAfterDiscordUpdates");
        require("./retainPatch").installRetainPatch();
    } catch (err) {
        console.error("[Kittycord] Failed to keep the patch across Discord updates", err);
    }
}
