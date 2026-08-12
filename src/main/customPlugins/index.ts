/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { stripBOM } from "../themes";
import { CUSTOM_PLUGINS_DIR } from "../utils/constants";
import { EXAMPLE_PLUGIN_SOURCE } from "./example";

export interface CustomPluginFile {
    fileName: string;
    source: string;
}

export function ensureCustomPluginsDir() {
    if (existsSync(CUSTOM_PLUGINS_DIR)) return;

    try {
        mkdirSync(CUSTOM_PLUGINS_DIR, { recursive: true });
        writeFileSync(join(CUSTOM_PLUGINS_DIR, "example.plugin.js"), EXAMPLE_PLUGIN_SOURCE, "utf-8");
    } catch (err) {
        console.error("[Kittycord] Failed to create the custom plugins folder:", err);
    }
}

export function listCustomPlugins(): CustomPluginFile[] {
    let files: string[];
    try {
        files = readdirSync(CUSTOM_PLUGINS_DIR);
    } catch {
        return [];
    }

    const plugins: CustomPluginFile[] = [];

    for (const fileName of files) {
        if (!fileName.endsWith(".js")) continue;

        try {
            plugins.push({ fileName, source: stripBOM(readFileSync(join(CUSTOM_PLUGINS_DIR, fileName), "utf-8")) });
        } catch (err) {
            console.error(`[Kittycord] Failed to read custom plugin ${fileName}:`, err);
        }
    }

    return plugins;
}
