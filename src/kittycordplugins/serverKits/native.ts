/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PAYLOAD_BYTES = 60_000;

export async function getKit(_: IpcMainInvokeEvent, id: unknown): Promise<unknown | null> {
    if (typeof id !== "string" || !UUID_RE.test(id)) return null;

    try {
        const res = await fetch(`${ENDPOINT}/kits/get?id=${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        const body = await res.json() as { kit?: unknown; };
        return body.kit && typeof body.kit === "object" ? body.kit : null;
    } catch {
        return null;
    }
}

export async function publishKit(_: IpcMainInvokeEvent, userId: unknown, kit: unknown): Promise<{ ok: true; id: string; ownerToken: string; } | { ok: false; error: string; }> {
    if (typeof userId !== "string" || !SNOWFLAKE_RE.test(userId)) return { ok: false, error: "Not signed in." };
    if (!kit || typeof kit !== "object") return { ok: false, error: "That kit is empty." };

    const payload = JSON.stringify({ id: userId, kit });
    if (payload.length > MAX_PAYLOAD_BYTES) return { ok: false, error: "That kit is too large to publish." };

    try {
        const res = await fetch(`${ENDPOINT}/kits/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload
        });

        const body = await res.json() as { id?: string; ownerToken?: string; error?: string; };
        if (!res.ok || !body.id || !body.ownerToken)
            return { ok: false, error: body.error ?? "Could not publish that kit." };

        return { ok: true, id: body.id, ownerToken: body.ownerToken };
    } catch {
        return { ok: false, error: "Could not reach the server." };
    }
}

export async function deleteKit(_: IpcMainInvokeEvent, id: unknown, ownerToken: unknown): Promise<boolean> {
    if (typeof id !== "string" || typeof ownerToken !== "string") return false;

    try {
        const res = await fetch(`${ENDPOINT}/kits/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ownerToken })
        });
        return res.ok;
    } catch {
        return false;
    }
}
