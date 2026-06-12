/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;

export async function announce(_: IpcMainInvokeEvent, id: unknown): Promise<void> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return;
    try {
        await fetch(`${ENDPOINT}/kc/announce`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
    } catch { /* offline / endpoint down -> ignore */ }
}

export async function getUsers(_: IpcMainInvokeEvent): Promise<string[]> {
    try {
        const res = await fetch(`${ENDPOINT}/kc/users`);
        if (!res.ok) return [];
        const body = await res.json() as { users?: unknown; };
        if (!Array.isArray(body.users)) return [];
        return body.users.filter((u): u is string => typeof u === "string" && SNOWFLAKE_RE.test(u));
    } catch {
        return [];
    }
}
