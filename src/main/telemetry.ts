/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Optional, anonymous usage stats. Runs in the MAIN process (so it isn't blocked by the renderer
// CSP and so the consent flag can be a local file). Sends ONLY a random install id + version, at
// most once a day, and ONLY when the user has explicitly consented. Stores nothing about the user,
// no account, no messages. Fully inert while ENDPOINT is empty (no prompt, no network).

import { IpcEvents } from "@shared/IpcEvents";
import { randomUUID } from "crypto";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import gitHash from "~git-hash";

import { DATA_DIR } from "./utils/constants";

// Set this to the deployed Cloudflare Worker URL (no trailing slash) to activate stats.
// When empty, telemetry does NOTHING: no consent prompt, no network request.
// Typed as string so the "is it configured?" checks below stay valid.
const ENDPOINT: string = "https://kittycord-analytics.hell-bullet-hb.workers.dev";

const FILE = join(DATA_DIR, "telemetry.json");
const DAY = 24 * 60 * 60 * 1000;

interface TelemetryState {
    id: string;
    consent: boolean | null;
    lastPing: number;
}

function read(): TelemetryState {
    try {
        const data = JSON.parse(readFileSync(FILE, "utf-8"));
        return { id: data.id ?? "", consent: data.consent ?? null, lastPing: data.lastPing ?? 0 };
    } catch {
        return { id: "", consent: null, lastPing: 0 };
    }
}

function write(state: TelemetryState) {
    try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(FILE, JSON.stringify(state), "utf-8");
    } catch { /* best effort */ }
}

function ensureId(state: TelemetryState): TelemetryState {
    if (!state.id) {
        state.id = randomUUID();
        write(state);
    }
    return state;
}

async function maybePing() {
    if (!ENDPOINT) return;

    const state = ensureId(read());
    if (state.consent !== true) return;
    if (Date.now() - state.lastPing < DAY) return;

    try {
        await fetch(`${ENDPOINT}/ping`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: state.id, version: gitHash.slice(0, 7) })
        });
        state.lastPing = Date.now();
        write(state);
    } catch { /* offline / endpoint down -> ignore */ }
}

ipcMain.handle(IpcEvents.GET_TELEMETRY_CONSENT, () => {
    const state = read();
    return { consent: state.consent, endpointConfigured: ENDPOINT !== "" };
});

ipcMain.handle(IpcEvents.SET_TELEMETRY_CONSENT, (_e, consent: boolean) => {
    const state = ensureId(read());
    state.consent = Boolean(consent);
    write(state);
    if (state.consent) void maybePing();
});

void maybePing();
