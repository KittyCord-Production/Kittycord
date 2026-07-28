/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * fallback for `hostUpdateHook.ts`. scans for a newer squirrel sibling
 * `app-VERSION` directory on quit and re-applies the patch there.
 */

import { app } from "electron";
import { dirname } from "path";

import { findStaleSibling, getPatcherJsPath, patchResourcesDir } from "./applyHostPatch";

app.on("before-quit", () => {
    try {
        const stale = findStaleSibling(dirname(process.execPath));
        if (stale) patchResourcesDir(stale, getPatcherJsPath());
    } catch (err) {
        console.error("[Kittycord] Failed to repatch latest host update", err);
    }
});
