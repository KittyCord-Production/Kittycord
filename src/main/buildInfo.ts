/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcEvents } from "@shared/IpcEvents";
import { createHash } from "crypto";
import { ipcMain } from "electron";
import { readFileSync } from "original-fs";

import gitHash from "~git-hash";

import { NativeSettings } from "./settings";

export interface BuildInfo {
    gitHash: string;
    asarHash: string | null;
    updateVerified: boolean | null;
    lastHostRepairAt: number | null;
}

export function recordUpdateVerified(verified: boolean) {
    NativeSettings.store.lastUpdateVerified = verified;
}

export function recordHostRepair() {
    NativeSettings.store.lastHostRepairAt = Date.now();
}

function hashRunningBuild() {
    try {
        return createHash("sha256").update(readFileSync(__dirname)).digest("hex");
    } catch {
        return null;
    }
}

ipcMain.handle(IpcEvents.GET_BUILD_INFO, (): BuildInfo => ({
    gitHash,
    asarHash: hashRunningBuild(),
    updateVerified: NativeSettings.plain.lastUpdateVerified ?? null,
    lastHostRepairAt: NativeSettings.plain.lastHostRepairAt ?? null
}));
