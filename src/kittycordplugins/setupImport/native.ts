/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR, THEMES_DIR } from "@main/utils/constants";
import { ensureSafePath } from "@main/utils/ensureSafePath";
import { createHash } from "crypto";
import { app, IpcMainInvokeEvent } from "electron";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, join, normalize } from "path";

const MAX_SETTINGS_BYTES = 5_000_000;
const MAX_QUICK_CSS_BYTES = 1_000_000;
const MAX_THEME_BYTES = 2_000_000;
const MAX_THEMES = 100;
const BD_CHANNELS = ["stable", "canary", "ptb"];

type SourceKind = "vencord" | "betterdiscord";

interface SourceDef {
    displayName: string;
    folder: string;
    kind: SourceKind;
}

const SOURCES: Record<string, SourceDef> = {
    vencord: { displayName: "Vencord", folder: "Vencord", kind: "vencord" },
    equicord: { displayName: "Equicord", folder: "Equicord", kind: "vencord" },
    vesktop: { displayName: "Vesktop", folder: "vesktop", kind: "vencord" },
    equibop: { displayName: "Equibop", folder: "Equibop", kind: "vencord" },
    betterdiscord: { displayName: "BetterDiscord", folder: "BetterDiscord", kind: "betterdiscord" }
};

export interface DetectedSource {
    key: string;
    displayName: string;
    kind: SourceKind;
    pluginCount: number;
    enabledCount: number;
    themeCount: number;
    hasQuickCss: boolean;
}

export interface SourceData {
    key: string;
    kind: SourceKind;
    settings: Record<string, unknown> | null;
    quickCss: string | null;
    themes: string[];
    bdEnabledThemes: string[];
}

function sourceDir(def: SourceDef) {
    return join(app.getPath("appData"), def.folder);
}

function isOwnDir(dir: string) {
    return normalize(dir) === normalize(DATA_DIR);
}

function stripBOM(text: string) {
    return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function readCapped(path: string, maxBytes: number): string | null {
    try {
        if (!existsSync(path) || statSync(path).size > maxBytes) return null;
        return stripBOM(readFileSync(path, "utf-8"));
    } catch {
        return null;
    }
}

function readJson(path: string, maxBytes: number): Record<string, unknown> | null {
    const text = readCapped(path, maxBytes);
    if (text === null) return null;
    try {
        const parsed = JSON.parse(text);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function hasControlChars(file: string) {
    for (let i = 0; i < file.length; i++)
        if (file.charCodeAt(i) < 32) return true;
    return false;
}

function isSafeThemeName(file: string) {
    return file === basename(file)
        && file.toLowerCase().endsWith(".css")
        && file.length <= 200
        && !hasControlChars(file);
}

function listThemes(dir: string): string[] {
    try {
        return readdirSync(dir).filter(isSafeThemeName).slice(0, MAX_THEMES);
    } catch {
        return [];
    }
}

function bdDataDir(dir: string): string | null {
    for (const channel of BD_CHANNELS) {
        const path = join(dir, "data", channel);
        if (existsSync(path)) return path;
    }
    return null;
}

function bdEnabledThemes(dir: string): string[] {
    const data = bdDataDir(dir);
    if (!data) return [];

    const map = readJson(join(data, "themes.json"), MAX_SETTINGS_BYTES);
    if (!map) return [];

    return Object.entries(map).filter(([, on]) => on === true).map(([file]) => file).filter(isSafeThemeName);
}

function quickCssPath(dir: string, kind: SourceKind): string | null {
    if (kind === "vencord") return join(dir, "settings", "quickCss.css");

    const data = bdDataDir(dir);
    return data ? join(data, "custom.css") : null;
}

function readSourceSettings(dir: string, kind: SourceKind) {
    return kind === "vencord" ? readJson(join(dir, "settings", "settings.json"), MAX_SETTINGS_BYTES) : null;
}

export async function detectSources(_: IpcMainInvokeEvent): Promise<DetectedSource[]> {
    const out: DetectedSource[] = [];

    for (const [key, def] of Object.entries(SOURCES)) {
        const dir = sourceDir(def);
        if (isOwnDir(dir) || !existsSync(dir)) continue;

        const settings = readSourceSettings(dir, def.kind);
        const plugins = settings?.plugins;
        const entries = plugins && typeof plugins === "object"
            ? Object.values(plugins as Record<string, { enabled?: boolean; }>)
            : [];

        const css = quickCssPath(dir, def.kind);

        const detected: DetectedSource = {
            key,
            displayName: def.displayName,
            kind: def.kind,
            pluginCount: entries.length,
            enabledCount: entries.filter(p => p?.enabled).length,
            themeCount: listThemes(join(dir, "themes")).length,
            hasQuickCss: Boolean(css && readCapped(css, MAX_QUICK_CSS_BYTES)?.trim())
        };

        if (!detected.pluginCount && !detected.themeCount && !detected.hasQuickCss) continue;

        out.push(detected);
    }

    return out;
}

export async function readSource(_: IpcMainInvokeEvent, key: unknown): Promise<SourceData | null> {
    if (typeof key !== "string") return null;

    const def = SOURCES[key];
    if (!def) return null;

    const dir = sourceDir(def);
    if (isOwnDir(dir) || !existsSync(dir)) return null;

    const css = quickCssPath(dir, def.kind);

    return {
        key,
        kind: def.kind,
        settings: readSourceSettings(dir, def.kind),
        quickCss: css ? readCapped(css, MAX_QUICK_CSS_BYTES) : null,
        themes: listThemes(join(dir, "themes")),
        bdEnabledThemes: def.kind === "betterdiscord" ? bdEnabledThemes(dir) : []
    };
}

function sha256(text: string) {
    return createHash("sha256").update(text).digest("hex");
}

function freeTarget(file: string) {
    const target = ensureSafePath(THEMES_DIR, file);
    if (!target) return null;
    if (!existsSync(target)) return { path: target, file };

    const base = file.replace(/\.css$/i, "");
    for (let i = 0; i < 20; i++) {
        const candidate = i === 0 ? `${base} (imported).css` : `${base} (imported ${i + 1}).css`;
        const path = ensureSafePath(THEMES_DIR, candidate);
        if (path && !existsSync(path)) return { path, file: candidate };
    }
    return null;
}

export async function copyThemes(_: IpcMainInvokeEvent, key: unknown, files: unknown): Promise<Record<string, string>> {
    const mapping: Record<string, string> = {};

    if (typeof key !== "string" || !Array.isArray(files)) return mapping;

    const def = SOURCES[key];
    if (!def) return mapping;

    const dir = sourceDir(def);
    const sourceThemes = join(dir, "themes");
    if (isOwnDir(dir) || !existsSync(sourceThemes)) return mapping;

    try {
        if (!existsSync(THEMES_DIR)) mkdirSync(THEMES_DIR, { recursive: true });
    } catch {
        return mapping;
    }

    for (const file of files.slice(0, MAX_THEMES)) {
        if (typeof file !== "string" || !isSafeThemeName(file)) continue;

        const from = ensureSafePath(sourceThemes, file);
        if (!from) continue;

        const css = readCapped(from, MAX_THEME_BYTES);
        if (css === null) continue;

        const existing = ensureSafePath(THEMES_DIR, file);
        if (existing && existsSync(existing)) {
            const current = readCapped(existing, MAX_THEME_BYTES);
            if (current !== null && sha256(current) === sha256(css)) {
                mapping[file] = file;
                continue;
            }
        }

        const target = freeTarget(file);
        if (!target) continue;

        try {
            writeFileSync(target.path, css, "utf-8");
            mapping[file] = target.file;
        } catch {
            continue;
        }
    }

    return mapping;
}
