/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get } from "@api/DataStore";

export const ONBOARDING_SEEN_KEY = "Kittycord_OnboardingSeen";

export interface FriendAction {
    kind: "claim" | "theme" | "pack";
    value: string;
}

let pending: FriendAction | null = null;
let listener: ((action: FriendAction) => void) | null = null;
const consumed = new Set<string>();

export async function onboardingPending(): Promise<boolean> {
    return !(await get(ONBOARDING_SEEN_KEY));
}

export function stashFriendAction(action: FriendAction) {
    if (listener) listener(action);
    else pending = action;
}

export function takeFriendAction(): FriendAction | null {
    const action = pending;
    pending = null;
    return action;
}

export function subscribeFriendAction(cb: (action: FriendAction) => void) {
    listener = cb;
    return () => {
        if (listener === cb) listener = null;
    };
}

export const friendConsumed = (action: FriendAction) => consumed.has(`${action.kind}:${action.value}`);

export function markFriendConsumed(action: FriendAction) {
    consumed.add(`${action.kind}:${action.value}`);
}
