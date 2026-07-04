/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { app, BrowserWindow, ipcMain } from "electron";

const SCHEME = "kittycord";
const CODE_RE = /^[a-z0-9_-]{3,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DeepLinkAction {
    kind: "claim" | "theme";
    value: string;
}

let pending: DeepLinkAction | null = null;

function getMainWindow(): BrowserWindow | undefined {
    return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

function parse(url: string): DeepLinkAction | null {
    let u: URL;
    try {
        u = new URL(url);
    } catch {
        return null;
    }
    if (u.protocol !== `${SCHEME}:`) return null;

    const kind = u.hostname.toLowerCase();
    const value = decodeURIComponent(u.pathname.replace(/^\/+/, "").replace(/\/+$/, ""));

    if (kind === "claim" && CODE_RE.test(value.toLowerCase())) return { kind: "claim", value: value.toLowerCase() };
    if (kind === "theme" && UUID_RE.test(value)) return { kind: "theme", value };
    return null;
}

function dispatch(url: string) {
    const action = parse(url);
    if (!action) return;

    const win = getMainWindow();
    if (!win) {
        pending = action;
        return;
    }

    win.webContents.send(IpcEvents.DEEP_LINK, action);
    if (win.isMinimized()) win.restore();
    win.focus();
}

function urlFromArgv(argv: string[]): string | undefined {
    return argv.find(a => a.startsWith(`${SCHEME}://`));
}

if (process.platform !== "darwin") {
    try {
        app.setAsDefaultProtocolClient(SCHEME);
    } catch { /* best effort; deep links just won't work if this fails */ }
}

app.on("second-instance", (_e, argv) => {
    const url = urlFromArgv(argv);
    if (url) dispatch(url);
});

app.on("open-url", (e, url) => {
    e.preventDefault();
    dispatch(url);
});

const initial = urlFromArgv(process.argv);
if (initial) pending = parse(initial);

ipcMain.handle(IpcEvents.DEEP_LINK_POLL, () => {
    const action = pending;
    pending = null;
    return action;
});
