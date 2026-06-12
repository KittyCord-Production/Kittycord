/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const EFFECTS = new Set(["", "shimmer"]);

export interface Cosmetic {
    id: string;
    color1: string;
    color2?: string;
    effect?: string;
}

export async function setCosmetic(_: IpcMainInvokeEvent, id: unknown, color1: unknown, color2: unknown, effect: unknown): Promise<{ ok: true; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof color1 !== "string" || !HEX_RE.test(color1)) return { ok: false, error: "Invalid color" };
    if (color2 != null && (typeof color2 !== "string" || !HEX_RE.test(color2))) return { ok: false, error: "Invalid color" };
    if (effect != null && (typeof effect !== "string" || !EFFECTS.has(effect))) return { ok: false, error: "Invalid effect" };
    try {
        const res = await fetch(`${ENDPOINT}/cosmetics/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, color1, color2: color2 ?? undefined, effect: effect ?? undefined })
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({})) as { error?: string; };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not save" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function clearCosmetic(_: IpcMainInvokeEvent, id: unknown): Promise<boolean> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return false;
    try {
        const res = await fetch(`${ENDPOINT}/cosmetics/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function getCosmetics(_: IpcMainInvokeEvent): Promise<Cosmetic[]> {
    try {
        const res = await fetch(`${ENDPOINT}/cosmetics`);
        if (!res.ok) return [];
        const body = await res.json() as { cosmetics?: unknown; };
        if (!Array.isArray(body.cosmetics)) return [];
        const out: Cosmetic[] = [];
        for (const raw of body.cosmetics) {
            if (!raw || typeof raw !== "object") continue;
            const { id, color1, color2, effect } = raw as Record<string, unknown>;
            if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) continue;
            if (typeof color1 !== "string" || !HEX_RE.test(color1)) continue;
            out.push({
                id,
                color1,
                color2: typeof color2 === "string" && HEX_RE.test(color2) ? color2 : undefined,
                effect: typeof effect === "string" && EFFECTS.has(effect) ? effect : undefined
            });
        }
        return out;
    } catch {
        return [];
    }
}
