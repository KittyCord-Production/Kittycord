/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Custom profile badges (a chosen emoji + short label). Main process (CSP-free). Setting a badge is
// an explicit user action; the badge list is a public cosmetic, so no consent gate. Validation and
// the Discord-impersonation blocklist are enforced server-side too.

import { BRAND_API } from "@branding";
import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";

const ENDPOINT: string = BRAND_API;
const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_ICON_LEN = 512;
const MAX_LABEL_LEN = 24;
const MAX_SLOTS = 5;

interface ServerBadge {
    id: string;
    emoji: string;
    label: string;
    slot?: number;
}

async function getBadges(): Promise<{ id: string; emoji: string; label: string; slot: number; }[]> {
    if (!ENDPOINT) return [];
    try {
        const res = await fetch(`${ENDPOINT}/badges`);
        if (!res.ok) return [];
        const body = await res.json() as { badges?: unknown; };
        if (!Array.isArray(body.badges)) return [];
        return body.badges
            .filter((b): b is ServerBadge =>
                b && typeof b.id === "string" && typeof b.emoji === "string" && typeof b.label === "string")
            .filter(b => b.slot === undefined || (typeof b.slot === "number" && b.slot >= 0 && b.slot < MAX_SLOTS))
            .map(b => ({ id: b.id, emoji: b.emoji, label: b.label, slot: b.slot ?? 0 }));
    } catch {
        return [];
    }
}

async function setBadge(id: unknown, emoji: unknown, label: unknown, slot: unknown): Promise<{ ok: boolean; error?: string; }> {
    if (!ENDPOINT) return { ok: false, error: "Not available" };
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS) return { ok: false, error: "Invalid slot" };
    if (typeof emoji !== "string" || emoji.length === 0 || emoji.length > MAX_ICON_LEN) return { ok: false, error: "Invalid icon" };
    if (typeof label !== "string" || label.length === 0 || label.length > MAX_LABEL_LEN) return { ok: false, error: "Invalid label" };

    try {
        const res = await fetch(`${ENDPOINT}/badges/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, emoji, label, slot })
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({})) as { error?: string; };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not save" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

async function clearBadge(id: unknown, slot: unknown): Promise<void> {
    if (!ENDPOINT) return;
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return;
    if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot >= MAX_SLOTS) return;
    try {
        await fetch(`${ENDPOINT}/badges/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, slot })
        });
    } catch { /* offline / endpoint down -> ignore */ }
}

ipcMain.handle(IpcEvents.GET_CUSTOM_BADGES, () => getBadges());
ipcMain.handle(IpcEvents.SET_CUSTOM_BADGE, (_e, id: unknown, emoji: unknown, label: unknown, slot: unknown) => setBadge(id, emoji, label, slot));
ipcMain.handle(IpcEvents.CLEAR_CUSTOM_BADGE, (_e, id: unknown, slot: unknown) => clearBadge(id, slot));
