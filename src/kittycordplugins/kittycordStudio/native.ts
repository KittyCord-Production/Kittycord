/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ensureSafePath } from "@main/ipcMain";
import { THEMES_DIR } from "@main/utils/constants";
import { IpcMainInvokeEvent } from "electron";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const FILE_NAME_RE = /^Kittycord Studio - [\w\-'!&. ]{1,40}\.theme\.css$/;
const MAX_CSS_BYTES = 200_000;
const MAX_DOWNLOAD_BYTES = 2_000_000;
const ALLOWED_HOST = /^(cdn|media)\.discordapp\.(com|net)$/;

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;

export async function writeTheme(_: IpcMainInvokeEvent, fileName: unknown, css: unknown): Promise<{ ok: true; } | { ok: false; error: string; }> {
    if (typeof fileName !== "string" || !FILE_NAME_RE.test(fileName)) return { ok: false, error: "Invalid theme name." };
    if (typeof css !== "string" || css.length > MAX_CSS_BYTES) return { ok: false, error: "Theme is too large." };

    const path = ensureSafePath(THEMES_DIR, fileName);
    if (!path) return { ok: false, error: "Invalid theme path." };

    try {
        if (!existsSync(THEMES_DIR)) mkdirSync(THEMES_DIR, { recursive: true });
        writeFileSync(path, css, "utf-8");
        return { ok: true };
    } catch {
        return { ok: false, error: "Could not write the theme file." };
    }
}

export async function downloadSetup(_: IpcMainInvokeEvent, url: unknown): Promise<{ ok: true; data: string; } | { ok: false; error: string; }> {
    if (typeof url !== "string") return { ok: false, error: "Bad URL" };

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { ok: false, error: "Bad URL" };
    }

    if (parsed.protocol !== "https:" || !ALLOWED_HOST.test(parsed.hostname)) {
        return { ok: false, error: "Blocked host" };
    }

    try {
        const res = await fetch(url);
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        if (Number(res.headers.get("content-length") ?? "0") > MAX_DOWNLOAD_BYTES) return { ok: false, error: "Too large" };

        const data = await res.text();
        if (data.length > MAX_DOWNLOAD_BYTES) return { ok: false, error: "Too large" };

        return { ok: true, data };
    } catch {
        return { ok: false, error: "Download failed" };
    }
}

export interface GalleryTheme {
    id: string;
    name: string;
    authorName: string;
    likes: number;
    created: number;
    featured?: boolean;
    params: unknown;
}

export async function listGallery(_: IpcMainInvokeEvent, sort: unknown): Promise<GalleryTheme[]> {
    const query = sort === "top" ? "top" : sort === "featured" ? "featured" : "new";
    try {
        const res = await fetch(`${ENDPOINT}/themes/list?sort=${query}`);
        if (!res.ok) return [];
        const body = await res.json() as { themes?: unknown; };
        return Array.isArray(body.themes) ? body.themes as GalleryTheme[] : [];
    } catch {
        return [];
    }
}

export async function publishTheme(_: IpcMainInvokeEvent, id: unknown, authorName: unknown, params: unknown): Promise<{ ok: true; id: string; ownerToken: string; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    try {
        const res = await fetch(`${ENDPOINT}/themes/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, authorName, params })
        });
        const body = await res.json().catch(() => ({})) as { id?: string; ownerToken?: string; error?: string; };
        if (res.ok && body.id && body.ownerToken) return { ok: true, id: body.id, ownerToken: body.ownerToken };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not publish" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function likeGalleryTheme(_: IpcMainInvokeEvent, id: unknown, themeId: unknown): Promise<{ likes: number; } | null> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id) || typeof themeId !== "string") return null;
    try {
        const res = await fetch(`${ENDPOINT}/themes/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, themeId })
        });
        if (!res.ok) return null;
        const body = await res.json() as { likes?: number; };
        return { likes: Number(body.likes ?? 0) };
    } catch {
        return null;
    }
}

export async function deleteGalleryTheme(_: IpcMainInvokeEvent, themeId: unknown, ownerToken: unknown): Promise<boolean> {
    if (typeof themeId !== "string" || typeof ownerToken !== "string") return false;
    try {
        const res = await fetch(`${ENDPOINT}/themes/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: themeId, ownerToken })
        });
        return res.ok;
    } catch {
        return false;
    }
}
