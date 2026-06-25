/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

const ENDPOINT = "https://kittycord-analytics.hell-bullet-hb.workers.dev";
const SNOWFLAKE_RE = /^\d{17,20}$/;
const ROLE_IDS = new Set(["kittycord-developer", "kittycord-staff", "kittycord-helper"]);

export interface TeamMember {
    id: string;
    role: string;
}

export async function getTeam(_: IpcMainInvokeEvent): Promise<TeamMember[] | null> {
    try {
        const res = await fetch(`${ENDPOINT}/team`);
        if (!res.ok) return null;
        const body = await res.json() as { members?: unknown; };
        if (!Array.isArray(body.members)) return null;
        const out: TeamMember[] = [];
        for (const raw of body.members) {
            if (!raw || typeof raw !== "object") continue;
            const { id, role } = raw as Record<string, unknown>;
            if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) continue;
            if (typeof role !== "string" || !ROLE_IDS.has(role)) continue;
            out.push({ id, role });
        }
        return out;
    } catch {
        return null;
    }
}
