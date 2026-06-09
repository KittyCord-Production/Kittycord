/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Custom profile badges (a chosen emoji + short label). Main process (CSP-free). Setting a badge is
// an explicit user action; the badge list is a public cosmetic, so no consent gate. Validation and
// the Discord-impersonation blocklist are enforced server-side too.

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";

const ENDPOINT: string = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_ICON_LEN = 512;
const MAX_LABEL_LEN = 24;

interface CustomBadge {
    id: string;
    emoji: string;
    label: string;
}

async function getBadges(): Promise<CustomBadge[]> {
    if (!ENDPOINT) return [];
    try {
        const res = await fetch(`${ENDPOINT}/badges`);
        if (!res.ok) return [];
        const body = await res.json() as { badges?: unknown; };
        if (!Array.isArray(body.badges)) return [];
        return body.badges.filter((b): b is CustomBadge =>
            b && typeof b.id === "string" && typeof b.emoji === "string" && typeof b.label === "string");
    } catch {
        return [];
    }
}

async function setBadge(id: unknown, emoji: unknown, label: unknown): Promise<{ ok: boolean; error?: string; }> {
    if (!ENDPOINT) return { ok: false, error: "Not available" };
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > MAX_ICON_LEN) return { ok: false, error: "Invalid icon" };
    if (typeof label !== "string" || label.length === 0 || label.length > MAX_LABEL_LEN) return { ok: false, error: "Invalid label" };

    try {
        const res = await fetch(`${ENDPOINT}/badges/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, emoji, label })
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({})) as { error?: string; };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not save" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

async function clearBadge(id: unknown): Promise<void> {
    if (!ENDPOINT) return;
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return;
    try {
        await fetch(`${ENDPOINT}/badges/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
    } catch { /* offline / endpoint down -> ignore */ }
}

ipcMain.handle(IpcEvents.GET_CUSTOM_BADGES, () => getBadges());
ipcMain.handle(IpcEvents.SET_CUSTOM_BADGE, (_e, id: unknown, emoji: unknown, label: unknown) => setBadge(id, emoji, label));
ipcMain.handle(IpcEvents.CLEAR_CUSTOM_BADGE, (_e, id: unknown) => clearBadge(id));
