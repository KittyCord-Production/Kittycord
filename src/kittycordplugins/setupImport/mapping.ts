/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const TOP_LEVEL_ALLOW = [
    "useQuickCss",
    "enabledThemes",
    "enabledThemeLinks",
    "themeLinks",
    "themeNames",
    "themeActivationModes",
    "userCssVars",
    "notifications",
    "uiElements",
    "frameless",
    "transparent",
    "winCtrlQ",
    "disableMinSize",
    "winNativeTitleBar"
] as const;

export interface PluginPlan {
    matched: string[];
    skipped: string[];
    settings: Record<string, Record<string, unknown>>;
}

export function planPlugins(sourcePlugins: unknown, known: (name: string) => boolean): PluginPlan {
    const plan: PluginPlan = { matched: [], skipped: [], settings: {} };

    if (!sourcePlugins || typeof sourcePlugins !== "object" || Array.isArray(sourcePlugins)) return plan;

    for (const [name, value] of Object.entries(sourcePlugins as Record<string, unknown>)) {
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        if (name.endsWith("API")) continue;

        if (!known(name)) {
            plan.skipped.push(name);
            continue;
        }

        plan.matched.push(name);
        plan.settings[name] = { ...value as Record<string, unknown> };
    }

    plan.matched.sort();
    plan.skipped.sort();

    return plan;
}

export function planTopLevel(sourceSettings: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};

    if (!sourceSettings || typeof sourceSettings !== "object" || Array.isArray(sourceSettings)) return out;

    const source = sourceSettings as Record<string, unknown>;
    for (const key of TOP_LEVEL_ALLOW)
        if (key in source && source[key] !== undefined) out[key] = source[key];

    return out;
}

export function remapThemes(enabled: unknown, copied: Record<string, string>): string[] {
    if (!Array.isArray(enabled)) return [];

    const out: string[] = [];
    for (const file of enabled) {
        if (typeof file !== "string") continue;
        const mapped = copied[file];
        if (mapped && !out.includes(mapped)) out.push(mapped);
    }
    return out;
}

export function mergeQuickCss(existing: string | null, incoming: string, sourceName: string): string {
    const current = (existing ?? "").trim();
    if (!current) return incoming;

    return `${current}\n\n/* Imported from ${sourceName} */\n${incoming}`;
}

export interface BuildPayloadOptions {
    source: { key: string; displayName: string; kind: string; };
    sourceSettings: unknown;
    plugins: PluginPlan | null;
    copiedThemes: Record<string, string> | null;
    bdEnabledThemes: string[];
    quickCss: string | null;
    existingQuickCss: string | null;
}

export function buildPayload(options: BuildPayloadOptions) {
    const { source, sourceSettings, plugins, copiedThemes, bdEnabledThemes, quickCss, existingQuickCss } = options;

    const settings: Record<string, unknown> = {};

    if (plugins) {
        Object.assign(settings, planTopLevel(sourceSettings));
        settings.plugins = plugins.settings;
    }

    if (copiedThemes) {
        const enabled = source.kind === "betterdiscord"
            ? bdEnabledThemes
            : (sourceSettings as { enabledThemes?: unknown; } | null)?.enabledThemes;

        const themes = remapThemes(enabled, copiedThemes);
        if (themes.length) settings.enabledThemes = themes;
        else delete settings.enabledThemes;
    } else {
        delete settings.enabledThemes;
    }

    const payload: { settings?: Record<string, unknown>; quickCss?: string; } = {};

    if (Object.keys(settings).length) payload.settings = settings;
    if (quickCss?.trim()) payload.quickCss = mergeQuickCss(existingQuickCss, quickCss, source.displayName);

    return payload;
}
