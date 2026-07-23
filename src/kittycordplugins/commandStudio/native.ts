/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_PAYLOAD_BYTES = 20_000;

export interface GalleryPackCommand {
    trigger: string;
    message: string;
    mode: "send" | "insert";
}

export interface GalleryPack {
    id: string;
    name: string;
    authorName: string;
    likes: number;
    created: number;
    featured?: boolean;
    commandCount: number;
    triggers?: string[];
    commands?: GalleryPackCommand[];
}

export async function listPacks(_: IpcMainInvokeEvent, sort: unknown): Promise<GalleryPack[]> {
    const query = sort === "top" ? "top" : sort === "featured" ? "featured" : "new";
    try {
        const res = await fetch(`${ENDPOINT}/packs/list?sort=${query}`);
        if (!res.ok) return [];
        const body = await res.json() as { packs?: unknown; };
        return Array.isArray(body.packs) ? body.packs as GalleryPack[] : [];
    } catch {
        return [];
    }
}

export async function getPack(_: IpcMainInvokeEvent, id: unknown): Promise<GalleryPack | null> {
    if (typeof id !== "string") return null;
    try {
        const res = await fetch(`${ENDPOINT}/packs/get?id=${encodeURIComponent(id)}`);
        if (!res.ok) return null;
        const body = await res.json() as { pack?: unknown; };
        return body.pack && typeof body.pack === "object" ? body.pack as GalleryPack : null;
    } catch {
        return null;
    }
}

export async function publishPack(_: IpcMainInvokeEvent, id: unknown, authorName: unknown, name: unknown, commands: unknown): Promise<{ ok: true; id: string; ownerToken: string; } | { ok: false; error: string; }> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return { ok: false, error: "Invalid id" };
    if (!Array.isArray(commands) || commands.length === 0) return { ok: false, error: "Nothing to publish" };

    const payload = JSON.stringify({ id, authorName, name, commands });
    if (payload.length > MAX_PAYLOAD_BYTES) return { ok: false, error: "That pack is too large to publish." };

    try {
        const res = await fetch(`${ENDPOINT}/packs/publish`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload
        });
        const body = await res.json().catch(() => ({})) as { id?: string; ownerToken?: string; error?: string; };
        if (res.ok && body.id && body.ownerToken) return { ok: true, id: body.id, ownerToken: body.ownerToken };
        return { ok: false, error: typeof body.error === "string" ? body.error : "Could not publish" };
    } catch {
        return { ok: false, error: "Offline" };
    }
}

export async function likePack(_: IpcMainInvokeEvent, id: unknown, packId: unknown): Promise<{ likes: number; } | null> {
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id) || typeof packId !== "string") return null;
    try {
        const res = await fetch(`${ENDPOINT}/packs/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, packId })
        });
        if (!res.ok) return null;
        const body = await res.json() as { likes?: number; };
        return { likes: Number(body.likes ?? 0) };
    } catch {
        return null;
    }
}

export async function deletePack(_: IpcMainInvokeEvent, packId: unknown, ownerToken: unknown): Promise<boolean> {
    if (typeof packId !== "string" || typeof ownerToken !== "string") return false;
    try {
        const res = await fetch(`${ENDPOINT}/packs/delete`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: packId, ownerToken })
        });
        return res.ok;
    } catch {
        return false;
    }
}
