/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// "Which friends use Kittycord?" registry. Main process (CSP-free, local opt-out file). On by
// default; sends only the user's own id (register) or friend ids (lookup) unless the user opts out.

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { DATA_DIR } from "./utils/constants";

const ENDPOINT: string = "https://kittycord-analytics.hell-bullet-hb.workers.dev";

const FILE = join(DATA_DIR, "shareRegistry.json");
const DAY = 24 * 60 * 60 * 1000;
const SNOWFLAKE_RE = /^\d{17,20}$/;
const MAX_FRIENDS = 1000;

interface ShareState {
    consent: boolean | null;
    lastRegister: number;
}

function read(): ShareState {
    try {
        const data = JSON.parse(readFileSync(FILE, "utf-8"));
        return { consent: data.consent ?? null, lastRegister: data.lastRegister ?? 0 };
    } catch {
        return { consent: null, lastRegister: 0 };
    }
}

function write(state: ShareState) {
    try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(FILE, JSON.stringify(state), "utf-8");
    } catch { /* best effort */ }
}

async function register(id: string) {
    if (!ENDPOINT) return;
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return;

    const state = read();
    if (state.consent === false) return;
    if (Date.now() - state.lastRegister < DAY) return;

    try {
        await fetch(`${ENDPOINT}/share/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        state.lastRegister = Date.now();
        write(state);
    } catch { /* offline / endpoint down -> ignore */ }
}

async function unregister(id: string) {
    if (!ENDPOINT) return;
    if (typeof id !== "string" || !SNOWFLAKE_RE.test(id)) return;

    try {
        await fetch(`${ENDPOINT}/share/unregister`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        const state = read();
        state.lastRegister = 0;
        write(state);
    } catch { /* offline / endpoint down -> ignore */ }
}

async function friendsCheck(ids: unknown): Promise<string[]> {
    if (!ENDPOINT) return [];
    if (read().consent === false) return [];
    if (!Array.isArray(ids)) return [];

    const clean = ids.filter((x): x is string => typeof x === "string" && SNOWFLAKE_RE.test(x)).slice(0, MAX_FRIENDS);
    if (clean.length === 0) return [];

    try {
        const res = await fetch(`${ENDPOINT}/share/friends-check`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids: clean })
        });
        if (!res.ok) return [];
        const body = await res.json() as { present?: unknown; };
        return Array.isArray(body.present) ? body.present.filter((x): x is string => typeof x === "string") : [];
    } catch {
        return [];
    }
}

ipcMain.handle(IpcEvents.GET_SHARE_CONSENT, () => {
    const state = read();
    return { consent: state.consent, endpointConfigured: ENDPOINT !== "" };
});

ipcMain.handle(IpcEvents.SET_SHARE_CONSENT, (_e, consent: boolean) => {
    const state = read();
    state.consent = Boolean(consent);
    if (!state.consent) state.lastRegister = 0;
    write(state);
});

ipcMain.handle(IpcEvents.SHARE_REGISTER, (_e, id: string) => register(id));

ipcMain.handle(IpcEvents.SHARE_UNREGISTER, (_e, id: string) => unregister(id));

ipcMain.handle(IpcEvents.SHARE_FRIENDS_CHECK, (_e, ids: unknown) => friendsCheck(ids));
