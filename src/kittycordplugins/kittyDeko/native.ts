/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

import { CATALOG, PRICED_IDS } from "./catalog";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const DEKO_IDS = new Set(CATALOG.map(d => d.id));

export interface DekoEntry {
    id: string;
    deco: string;
}

export interface CoinStatus {
    balance: number;
    owned: string[];
}

export async function getCoins(_: IpcMainInvokeEvent, id: unknown): Promise<CoinStatus> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { balance: 0, owned: [] };
    try {
        const res = await fetch(`${ENDPOINT}/coins?id=${encodeURIComponent(id)}`);
        if (!res.ok) return { balance: 0, owned: [] };
        const body = await res.json() as { balance?: unknown; owned?: unknown; };
        const owned = Array.isArray(body.owned)
            ? body.owned.filter((o): o is string => typeof o === "string" && DEKO_IDS.has(o))
            : [];
        return { balance: Number(body.balance) || 0, owned };
    } catch {
        return { balance: 0, owned: [] };
    }
}

export async function buyDeko(_: IpcMainInvokeEvent, id: unknown, deco: unknown): Promise<{ ok: true; balance: number; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof deco !== "string" || !PRICED_IDS.has(deco)) return { ok: false, error: "That frame isn't for sale." };
    try {
        const res = await fetch(`${ENDPOINT}/deko/buy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, deco })
        });
        const body = await res.json().catch(() => ({})) as { balance?: unknown; error?: string; };
        if (res.ok) return { ok: true, balance: Number(body.balance) || 0 };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not buy that frame." };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function setDeko(_: IpcMainInvokeEvent, id: unknown, deco: unknown): Promise<{ ok: true; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof deco !== "string" || !DEKO_IDS.has(deco)) return { ok: false, error: "Invalid decoration" };
    try {
        const res = await fetch(`${ENDPOINT}/deko/set`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, deco })
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({})) as { error?: string; };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not save" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function clearDeko(_: IpcMainInvokeEvent, id: unknown): Promise<boolean> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return false;
    try {
        const res = await fetch(`${ENDPOINT}/deko/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function getDeko(_: IpcMainInvokeEvent): Promise<DekoEntry[]> {
    try {
        const res = await fetch(`${ENDPOINT}/deko`);
        if (!res.ok) return [];
        const body = await res.json() as { deko?: unknown; };
        if (!Array.isArray(body.deko)) return [];
        const out: DekoEntry[] = [];
        for (const raw of body.deko) {
            if (!raw || typeof raw !== "object") continue;
            const { id, deco } = raw as Record<string, unknown>;
            if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) continue;
            if (typeof deco !== "string" || !DEKO_IDS.has(deco)) continue;
            out.push({ id, deco });
        }
        return out;
    } catch {
        return [];
    }
}
