/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DATA_DIR } from "@main/utils/constants";
import { app, IpcMainInvokeEvent } from "electron";
import { readFileSync, unlinkSync } from "fs";
import { join } from "path";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const CODE_RE = /^[a-z0-9_-]{3,20}$/;

export interface MyInvites {
    code: string | null;
    invites: number;
    rank: number | null;
    invitedBy: string | null;
}

export interface LeaderboardEntry {
    id: string;
    n: number;
}

function referralPaths(): string[] {
    const paths = [join(DATA_DIR, "referral.json")];
    try {
        paths.push(join(app.getPath("appData"), "Kittycord", "referral.json"));
    } catch { /* appData unavailable */ }
    return paths;
}

export async function consumeReferralCode(_: IpcMainInvokeEvent): Promise<string | null> {
    for (const path of referralPaths()) {
        try {
            const code = JSON.parse(readFileSync(path, "utf-8"))?.code;
            try { unlinkSync(path); } catch { /* best effort */ }
            if (typeof code === "string" && CODE_RE.test(code.toLowerCase())) return code.toLowerCase();
        } catch { /* not present here */ }
    }
    return null;
}

export async function setCode(_: IpcMainInvokeEvent, id: unknown, code: unknown): Promise<{ ok: true; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (typeof code !== "string" || !CODE_RE.test(code.toLowerCase())) return { ok: false, error: "Code must be 3-20 letters, numbers, - or _" };
    try {
        const res = await fetch(`${ENDPOINT}/invites/setcode`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, code: code.toLowerCase() })
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({})) as { error?: string; };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not save" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function claim(_: IpcMainInvokeEvent, inviteeId: unknown, code: unknown): Promise<boolean> {
    if (typeof inviteeId !== "string" || !SNOWFLAKE_RE.test(inviteeId)) return false;
    if (typeof code !== "string" || !CODE_RE.test(code.toLowerCase())) return false;
    try {
        const res = await fetch(`${ENDPOINT}/invites/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteeId, code: code.toLowerCase() })
        });
        const body = await res.json().catch(() => ({})) as { ok?: boolean; };
        return body.ok === true;
    } catch {
        return false;
    }
}

export async function getMe(_: IpcMainInvokeEvent, id: unknown): Promise<MyInvites> {
    const empty: MyInvites = { code: null, invites: 0, rank: null, invitedBy: null };
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return empty;
    try {
        const res = await fetch(`${ENDPOINT}/invites/me`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        if (!res.ok) return empty;
        const body = await res.json() as Partial<MyInvites>;
        return {
            code: typeof body.code === "string" ? body.code : null,
            invites: Number(body.invites ?? 0),
            rank: typeof body.rank === "number" ? body.rank : null,
            invitedBy: typeof body.invitedBy === "string" ? body.invitedBy : null
        };
    } catch {
        return empty;
    }
}

export async function getLeaderboard(_: IpcMainInvokeEvent, limit = 100): Promise<LeaderboardEntry[]> {
    try {
        const res = await fetch(`${ENDPOINT}/invites/leaderboard?limit=${encodeURIComponent(limit)}`);
        if (!res.ok) return [];
        const body = await res.json() as { leaderboard?: unknown; };
        if (!Array.isArray(body.leaderboard)) return [];
        const out: LeaderboardEntry[] = [];
        for (const raw of body.leaderboard) {
            if (!raw || typeof raw !== "object") continue;
            const { id, n } = raw as Record<string, unknown>;
            if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) continue;
            out.push({ id, n: Number(n ?? 0) });
        }
        return out;
    } catch {
        return [];
    }
}
