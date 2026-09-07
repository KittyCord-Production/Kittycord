/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ACCENT_PRESETS, KittycordAccent } from "@shared/accentPresets";
import { app } from "electron";
import { readFileSync, rmSync } from "fs";
import { join } from "path";

import { RendererSettings } from "./settings";
import { DATA_DIR } from "./utils/constants";

try {
    const candidates = new Set<string>([join(DATA_DIR, "style.json")]);
    try {
        candidates.add(join(app.getPath("appData"), "Kittycord", "style.json"));
    } catch { }

    for (const path of candidates) {
        let raw: string;
        try {
            raw = readFileSync(path, "utf-8");
        } catch {
            continue;
        }
        try {
            const accent = JSON.parse(raw.trim())?.accent;
            if (typeof accent === "string" && Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, accent)) {
                RendererSettings.store.kittycordAccent = accent as KittycordAccent;
            }
        } catch { }
        try {
            rmSync(path);
        } catch { }
    }
} catch { }
