/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";

export interface NewsItem {
    id: string;
    title: string;
    body: string;
    url: string | null;
    created: number;
}

export async function getNews(_: IpcMainInvokeEvent): Promise<NewsItem[]> {
    try {
        const res = await fetch(`${ENDPOINT}/news/list`);
        if (!res.ok) return [];
        const body = await res.json() as { news?: unknown; };
        if (!Array.isArray(body.news)) return [];
        const out: NewsItem[] = [];
        for (const raw of body.news) {
            if (!raw || typeof raw !== "object") continue;
            const { id, title, body: text, url, created } = raw as Record<string, unknown>;
            if (typeof id !== "string" || typeof title !== "string" || typeof text !== "string") continue;
            out.push({
                id,
                title,
                body: text,
                url: typeof url === "string" && /^https:\/\//i.test(url) ? url : null,
                created: Number(created) || 0
            });
        }
        return out;
    } catch {
        return [];
    }
}
