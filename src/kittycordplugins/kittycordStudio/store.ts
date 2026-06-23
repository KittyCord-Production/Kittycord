/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { Settings } from "@api/Settings";
import type { PluginNative } from "@utils/types";
import { UserStore } from "@webpack/common";

import { generateCss, sanitizeParams, type StudioParams, themeFileName } from "./template";

const KEY = "Kittycord_StudioThemes";
const TOKENS_KEY = "Kittycord_StudioTokens";

const Native = VencordNative?.pluginHelpers?.KittycordStudio as PluginNative<typeof import("./native")> | undefined;

export const galleryAvailable = () => Boolean(Native);

let themes: Record<string, StudioParams> = {};
let loaded = false;

export async function loadThemes(): Promise<Record<string, StudioParams>> {
    if (!loaded) {
        themes = (await get<Record<string, StudioParams>>(KEY)) ?? {};
        loaded = true;
    }
    return themes;
}

export const getThemes = () => themes;

async function persist() {
    await set(KEY, themes);
}

async function writeThemeFile(fileName: string, css: string) {
    if (Native) {
        const result = await Native.writeTheme(fileName, css);
        if (!result.ok) throw new Error(result.error);
    } else {
        await VencordNative.themes.uploadTheme(fileName, css);
    }
}

export async function saveTheme(params: StudioParams, previousFileName?: string): Promise<string> {
    const fileName = themeFileName(params);

    if (previousFileName && previousFileName !== fileName) {
        await removeTheme(previousFileName);
    }

    await writeThemeFile(fileName, generateCss(params));
    themes = { ...themes, [fileName]: params };
    await persist();
    return fileName;
}

export async function removeTheme(fileName: string) {
    try {
        await VencordNative.themes.deleteTheme(fileName);
    } catch { }
    Settings.enabledThemes = Settings.enabledThemes.filter(t => t !== fileName);
    const { [fileName]: _, ...rest } = themes;
    themes = rest;
    await persist();
}

export function enableTheme(fileName: string) {
    if (!Settings.enabledThemes.includes(fileName))
        Settings.enabledThemes = [...Settings.enabledThemes, fileName];
}

export const isThemeEnabled = (fileName: string) => Settings.enabledThemes.includes(fileName);

export interface GalleryTheme {
    id: string;
    name: string;
    authorName: string;
    likes: number;
    created: number;
    featured: boolean;
    params: StudioParams;
}

export type GallerySort = "new" | "top" | "featured";

export async function browseGallery(sort: GallerySort): Promise<GalleryTheme[]> {
    if (!Native) return [];
    const raw = await Native.listGallery(sort);
    const out: GalleryTheme[] = [];
    for (const t of raw) {
        try {
            out.push({
                id: String(t.id),
                name: String(t.name),
                authorName: String(t.authorName),
                likes: Number(t.likes) || 0,
                created: Number(t.created) || 0,
                featured: Boolean(t.featured),
                params: sanitizeParams(t.params)
            });
        } catch { }
    }
    return out;
}

async function getTokens(): Promise<Record<string, string>> {
    return (await get<Record<string, string>>(TOKENS_KEY)) ?? {};
}

export async function publishTheme(params: StudioParams, authorName: string): Promise<void> {
    if (!Native) throw new Error("The gallery needs the Kittycord desktop app.");
    const me = UserStore.getCurrentUser();
    if (!me) throw new Error("Could not read your account.");

    const result = await Native.publishTheme(me.id, authorName, params);
    if (!result.ok) throw new Error(result.error);

    const tokens = await getTokens();
    tokens[result.id] = result.ownerToken;
    await set(TOKENS_KEY, tokens);
}

export async function likeGalleryTheme(themeId: string): Promise<number | null> {
    if (!Native) return null;
    const me = UserStore.getCurrentUser();
    if (!me) return null;
    const result = await Native.likeGalleryTheme(me.id, themeId);
    return result ? result.likes : null;
}

export async function isMyTheme(themeId: string): Promise<boolean> {
    return Boolean((await getTokens())[themeId]);
}

export async function deleteGalleryTheme(themeId: string): Promise<boolean> {
    if (!Native) return false;
    const tokens = await getTokens();
    const token = tokens[themeId];
    if (!token) return false;
    const ok = await Native.deleteGalleryTheme(themeId, token);
    if (ok) {
        delete tokens[themeId];
        await set(TOKENS_KEY, tokens);
    }
    return ok;
}
