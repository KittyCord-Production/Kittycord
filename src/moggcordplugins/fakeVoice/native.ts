/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BrowserWindow, IpcMainInvokeEvent } from "electron";

// must match BLACK_WINDOW_TITLE in index.tsx, which finds this window by name
const BLACK_WINDOW_TITLE = "Kittycord Black Screen";

let win: BrowserWindow | null = null;

// A plain black window that Discord's own screen capture can stream. It sits off to the side and
// never takes focus, so the stream shows nothing while the user keeps working normally.
export async function openBlackWindow(_: IpcMainInvokeEvent): Promise<string> {
    if (!win || win.isDestroyed()) {
        win = new BrowserWindow({
            width: 1280,
            height: 720,
            x: -1400,
            y: 0,
            frame: false,
            skipTaskbar: true,
            focusable: false,
            show: false,
            backgroundColor: "#000000",
            title: BLACK_WINDOW_TITLE,
            webPreferences: { sandbox: true, javascript: false }
        });
        win.on("page-title-updated", e => e.preventDefault());
        await win.loadURL("data:text/html,<body style='background:#000;margin:0'></body>");
        win.showInactive();
    }
    return win.getMediaSourceId();
}

export async function closeBlackWindow(_: IpcMainInvokeEvent) {
    if (win && !win.isDestroyed()) win.destroy();
    win = null;
}
