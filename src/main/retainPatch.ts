/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { watch } from "original-fs";
import { dirname } from "path";

import { findStaleSibling, getPatcherJsPath, isAlreadyPatched, patchResourcesDir } from "./applyHostPatch";

const DEBOUNCE_MS = 1_500;
const RETRY_INTERVAL_MS = 1_500;
const RETRY_WINDOW_MS = 30_000;
const FALLBACK_SCAN_MS = 60_000;

let installed = false;
let debounce: ReturnType<typeof setTimeout> | null = null;
let retry: ReturnType<typeof setInterval> | null = null;
let retryDeadline = 0;

const stopRetry = () => {
    if (retry) {
        clearInterval(retry);
        retry = null;
    }
};

const attempt = (): boolean => {
    try {
        const stale = findStaleSibling(dirname(process.execPath));
        if (!stale || isAlreadyPatched(stale)) return true;
        return patchResourcesDir(stale, getPatcherJsPath());
    } catch (err) {
        console.error("[Kittycord] retain-patch attempt failed", err);
        return true;
    }
};

const run = () => {
    if (attempt()) {
        stopRetry();
        return;
    }
    if (retry) return;
    retryDeadline = Date.now() + RETRY_WINDOW_MS;
    retry = setInterval(() => {
        if (Date.now() > retryDeadline || attempt()) stopRetry();
    }, RETRY_INTERVAL_MS);
};

const onChange = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(run, DEBOUNCE_MS);
};

export const repatchNow = (): boolean => {
    try {
        if (process.platform === "darwin")
            return patchResourcesDir(process.resourcesPath, getPatcherJsPath());
        if (process.platform !== "win32") return false;
        const stale = findStaleSibling(dirname(process.execPath));
        if (!stale) return false;
        return patchResourcesDir(stale, getPatcherJsPath());
    } catch (err) {
        console.error("[Kittycord] manual repatch failed", err);
        return false;
    }
};

export const installRetainPatch = () => {
    if (installed || process.platform !== "win32") return;
    installed = true;

    run();

    try {
        watch(dirname(dirname(process.execPath)), { persistent: false }, onChange);
    } catch (err) {
        console.error("[Kittycord] Failed to watch for host updates", err);
    }

    setInterval(run, FALLBACK_SCAN_MS).unref();
};
