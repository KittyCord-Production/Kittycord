/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Themes that ship with Kittycord. On startup they are written into the user's themes folder so
// they show up in Settings > Themes for everyone. Only written when missing, so we never clobber
// a user's edits (delete the file and restart to get the latest bundled version back).

import amoledBlack from "file://themes/amoledBlack.theme.css";
import lavender from "file://themes/lavender.theme.css";
import midnight from "file://themes/midnight.theme.css";
import monoGlass from "file://themes/monoGlass.theme.css";
import sakura from "file://themes/sakura.theme.css";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

import { THEMES_DIR } from "./utils/constants";

const BUNDLED_THEMES: Record<string, string> = {
    "MonoGlass.theme.css": monoGlass,
    "Sakura.theme.css": sakura,
    "Midnight.theme.css": midnight,
    "AMOLEDBlack.theme.css": amoledBlack,
    "Lavender.theme.css": lavender
};

try {
    mkdirSync(THEMES_DIR, { recursive: true });
    for (const [fileName, css] of Object.entries(BUNDLED_THEMES)) {
        const path = join(THEMES_DIR, fileName);
        if (!existsSync(path)) writeFileSync(path, css, "utf-8");
    }
} catch (err) {
    console.error("[Kittycord] Failed to install bundled themes", err);
}
