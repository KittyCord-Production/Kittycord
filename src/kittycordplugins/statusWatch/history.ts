/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

import type { StatusBucket } from "./presence";

const KEY = "Kittycord_StatusWatch_History";
const LIMIT = 200;

export interface HistoryEntry {
    userId: string;
    from: StatusBucket;
    to: StatusBucket;
    at: number;
}

let entries: HistoryEntry[] = [];

export function getHistory(): HistoryEntry[] {
    return entries;
}

export async function loadHistory() {
    entries = (await get<HistoryEntry[]>(KEY)) ?? [];
}

export async function record(entry: HistoryEntry) {
    entries = [entry, ...entries].slice(0, LIMIT);
    await set(KEY, entries);
}

export async function clearHistory() {
    entries = [];
    await set(KEY, entries);
}
