/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;

export interface SupporterStatus {
    supporter: boolean;
    roles: string[];
    since: number | null;
}

export async function getStatus(_: IpcMainInvokeEvent, id: unknown): Promise<SupporterStatus> {
    const empty: SupporterStatus = { supporter: false, roles: [], since: null };
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return empty;
    try {
        const res = await fetch(`${ENDPOINT}/supporter?id=${id}`);
        if (!res.ok) return empty;
        const body = await res.json() as Partial<SupporterStatus>;
        return {
            supporter: body.supporter === true,
            roles: Array.isArray(body.roles) ? body.roles.filter(r => typeof r === "string") : [],
            since: typeof body.since === "number" ? body.since : null
        };
    } catch {
        return empty;
    }
}
