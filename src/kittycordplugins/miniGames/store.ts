/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

const KEY = "Kittycord_MiniGamesPending";

interface PendingReveal {
    choice: number;
    nonce: string;
}

type PendingMap = Record<string, PendingReveal>;

let cache: PendingMap | null = null;

async function load(): Promise<PendingMap> {
    if (!cache) cache = (await get<PendingMap>(KEY)) ?? {};
    return cache;
}

export async function storePending(gameId: string, choice: number, nonce: string) {
    const map = await load();
    map[gameId] = { choice, nonce };
    await set(KEY, map);
}

export async function getPending(gameId: string): Promise<PendingReveal | null> {
    const map = await load();
    return map[gameId] ?? null;
}

export async function removePending(gameId: string) {
    const map = await load();
    if (gameId in map) {
        delete map[gameId];
        await set(KEY, map);
    }
}
