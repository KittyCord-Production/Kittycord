/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { AsyncLocalStorage } from "async_hooks";
import { app, ipcMain, session } from "electron";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { DATA_DIR } from "./utils/constants";

const LOG_FILE = join(DATA_DIR, "requestLog.json");
const MAX_ENTRIES = 300;

export interface RequestEntry {
    at: number;
    kind: "api" | "asset";
    method: string;
    host: string;
    path: string;
    status: number;
    bytesOut: number;
    purpose: string;
    plugin: string | null;
}

interface Totals {
    [purpose: string]: number;
}

const PURPOSES: { test: (host: string, path: string) => boolean; purpose: string; }[] = [
    { test: (_, p) => p === "/ping", purpose: "Usage stats" },
    { test: (_, p) => p === "/crash", purpose: "Crash report" },
    { test: (_, p) => p.startsWith("/share/"), purpose: "Friends registry" },
    { test: (_, p) => p.startsWith("/badges"), purpose: "Profile badges" },
    { test: (_, p) => p.startsWith("/cosmetics"), purpose: "Name colours" },
    { test: (_, p) => p.startsWith("/deko") || p.startsWith("/coins"), purpose: "Avatar decorations" },
    { test: (_, p) => p.startsWith("/themes"), purpose: "Theme gallery" },
    { test: (_, p) => p.startsWith("/packs"), purpose: "Command packs" },
    { test: (_, p) => p.startsWith("/invites"), purpose: "Invites" },
    { test: (_, p) => p.startsWith("/kc/"), purpose: "Kittycord users" },
    { test: (_, p) => p.startsWith("/news"), purpose: "Community news" },
    { test: (_, p) => p === "/team" || p.startsWith("/supporter"), purpose: "Supporter status" },
    { test: (_, p) => p.startsWith("/sounds") || p.startsWith("/fonts") || p.startsWith("/bg/") || p.startsWith("/pattern/"), purpose: "Downloading assets" },
    { test: h => h === "api.github.com", purpose: "Checking for updates" },
    { test: h => h.endsWith("scdn.co"), purpose: "Album artwork" }
];

const entries: RequestEntry[] = [];
const pluginStore = new AsyncLocalStorage<string>();
let totals: Totals = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function runAsPlugin<T>(plugin: string, fn: () => T): T {
    return pluginStore.run(plugin, fn);
}

function purposeOf(host: string, path: string) {
    return PURPOSES.find(p => p.test(host, path))?.purpose ?? "Other";
}

function loadTotals() {
    try {
        if (!existsSync(LOG_FILE)) return {};
        const parsed = JSON.parse(readFileSync(LOG_FILE, "utf-8"));
        return parsed && typeof parsed === "object" ? parsed.totals ?? {} : {};
    } catch {
        return {};
    }
}

function saveTotals() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            writeFileSync(LOG_FILE, JSON.stringify({ totals }), "utf-8");
        } catch { }
    }, 5000);
}

export function record(entry: RequestEntry) {
    entries.push(entry);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);

    totals[entry.purpose] = (totals[entry.purpose] ?? 0) + 1;
    saveTotals();
}

function bodySize(init?: RequestInit) {
    const body = init?.body;
    if (typeof body === "string") return Buffer.byteLength(body);
    if (body instanceof ArrayBuffer) return body.byteLength;
    if (ArrayBuffer.isView(body)) return body.byteLength;
    return 0;
}

const ASSET_URLS = [
    "https://kittycord-analytics.hell-bullet-hb.workers.dev/*",
    "https://i.scdn.co/*"
];

function watchAssetRequests() {
    app.whenReady().then(() => {
        session.defaultSession.webRequest.onCompleted({ urls: ASSET_URLS }, details => {
            if (details.resourceType === "xhr" || details.resourceType === "mainFrame") return;

            let url: URL;
            try {
                url = new URL(details.url);
            } catch {
                return;
            }

            record({
                at: Date.now(),
                kind: "asset",
                method: details.method,
                host: url.host,
                path: url.pathname,
                status: details.statusCode,
                bytesOut: 0,
                purpose: purposeOf(url.host, url.pathname),
                plugin: null
            });
        });
    }).catch(() => { });
}

export function installRequestLog() {
    totals = loadTotals();

    const original = globalThis.fetch;

    globalThis.fetch = async function loggedFetch(this: unknown, input: any, init?: any) {
        let url: URL | null = null;
        try {
            url = new URL(typeof input === "string" ? input : input?.url ?? String(input));
        } catch { }

        const plugin = pluginStore.getStore() ?? null;
        const at = Date.now();

        try {
            const res = await original.call(this, input, init);
            if (url) record({
                at,
                kind: "api",
                method: (init?.method ?? "GET").toUpperCase(),
                host: url.host,
                path: url.pathname,
                status: res.status,
                bytesOut: bodySize(init),
                purpose: purposeOf(url.host, url.pathname),
                plugin
            });
            return res;
        } catch (err) {
            if (url) record({
                at,
                kind: "api",
                method: (init?.method ?? "GET").toUpperCase(),
                host: url.host,
                path: url.pathname,
                status: 0,
                bytesOut: bodySize(init),
                purpose: purposeOf(url.host, url.pathname),
                plugin
            });
            throw err;
        }
    } as typeof fetch;

    watchAssetRequests();

    ipcMain.handle(IpcEvents.GET_REQUEST_LOG, () => ({ entries: [...entries], totals: { ...totals } }));

    ipcMain.handle(IpcEvents.CLEAR_REQUEST_LOG, () => {
        entries.length = 0;
        totals = {};
        try {
            writeFileSync(LOG_FILE, JSON.stringify({ totals }), "utf-8");
        } catch { }
    });
}
