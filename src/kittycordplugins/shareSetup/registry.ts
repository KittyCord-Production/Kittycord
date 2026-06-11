/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { RelationshipStore, UserStore } from "@webpack/common";

export const getShareConsent = () => VencordNative.kittycordShare.getConsent();
export const setShareConsent = (value: boolean) => VencordNative.kittycordShare.setConsent(value);

export function registerSelf(): Promise<void> {
    const me = UserStore.getCurrentUser();
    return me?.id ? VencordNative.kittycordShare.register(me.id) : Promise.resolve();
}

export function unregisterSelf(): Promise<void> {
    const me = UserStore.getCurrentUser();
    return me?.id ? VencordNative.kittycordShare.unregister(me.id) : Promise.resolve();
}

export async function getKittycordFriendIds(): Promise<string[]> {
    const friendIds = RelationshipStore.getFriendIDs?.() ?? [];
    if (friendIds.length === 0) return [];
    return VencordNative.kittycordShare.friendsCheck(friendIds);
}
