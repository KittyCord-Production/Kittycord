/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import type { StatusBucket } from "./presence";
import { WatchList } from "./WatchList";

export type WatchEntry = Record<StatusBucket, boolean>;

export const settings = definePluginSettings({
    watched: {
        type: OptionType.CUSTOM,
        description: "",
        default: {} as Record<string, WatchEntry>
    },
    watchList: {
        type: OptionType.COMPONENT,
        component: WatchList
    }
});

export function isWatched(userId: string): boolean {
    return Boolean(settings.store.watched[userId]);
}

export function toggleWatch(userId: string): boolean {
    const { [userId]: existing, ...rest } = settings.store.watched;

    if (existing) {
        settings.store.watched = rest;
        return false;
    }

    settings.store.watched = { ...rest, [userId]: { online: true, idle: true, dnd: true, offline: true } };
    return true;
}

export function setEvent(userId: string, bucket: StatusBucket, value: boolean) {
    const entry = settings.store.watched[userId];
    if (!entry) return;

    settings.store.watched = { ...settings.store.watched, [userId]: { ...entry, [bucket]: value } };
}
