/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import gitHash from "~git-hash";

import { DATA_DIR } from "./utils/constants";

const ENDPOINT: string = "https://kittycord-analytics.hell-bullet-hb.workers.dev";

const FILE = join(DATA_DIR, "crash.json");
const MAX_MSG = 500;
const MAX_STACK = 4000;
const MAX_PLUGIN = 64;

interface CrashState {
    consent: boolean | null;
}

function read(): CrashState {
    try {
        const data = JSON.parse(readFileSync(FILE, "utf-8"));
        return { consent: data.consent ?? null };
    } catch {
        return { consent: null };
    }
}

function write(state: CrashState) {
    try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
        writeFileSync(FILE, JSON.stringify(state), "utf-8");
    } catch { /* best effort */ }
}

ipcMain.handle(IpcEvents.GET_CRASH_CONSENT, () => {
    return { consent: read().consent, endpointConfigured: ENDPOINT !== "" };
});

ipcMain.handle(IpcEvents.SET_CRASH_CONSENT, (_e, consent: boolean) => {
    write({ consent: Boolean(consent) });
});

ipcMain.handle(IpcEvents.REPORT_CRASH, async (_e, payload: unknown) => {
    if (!ENDPOINT || read().consent !== true) return;
    if (!payload || typeof payload !== "object") return;

    const { message, stack, plugin } = payload as Record<string, unknown>;
    if (typeof message !== "string" || message.length === 0) return;

    const body = {
        version: gitHash.slice(0, 7),
        platform: process.platform,
        message: message.slice(0, MAX_MSG),
        stack: typeof stack === "string" ? stack.slice(0, MAX_STACK) : undefined,
        plugin: typeof plugin === "string" ? plugin.slice(0, MAX_PLUGIN) : undefined
    };

    try {
        await fetch(`${ENDPOINT}/crash`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });
    } catch { /* offline / endpoint down -> ignore */ }
});
