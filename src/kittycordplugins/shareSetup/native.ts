/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const MAX_BYTES = 2_000_000;
const ALLOWED_HOST = /^(cdn|media)\.discordapp\.(com|net)$/;

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
        if (Number(res.headers.get("content-length") ?? "0") > MAX_BYTES) return { ok: false, error: "Too large" };

        const data = await res.text();
        if (data.length > MAX_BYTES) return { ok: false, error: "Too large" };

        return { ok: true, data };
    } catch {
        return { ok: false, error: "Download failed" };
    }
}
