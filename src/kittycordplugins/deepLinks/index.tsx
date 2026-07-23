/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import definePlugin, { type PluginNative } from "@utils/types";
import { showToast, Toasts, UserStore } from "@webpack/common";

import { type FriendAction, friendConsumed, markFriendConsumed, onboardingPending, stashFriendAction } from "../_shared/friendLink";
import { openPackImport } from "../commandStudio/PackGallery";
import { applyGalleryThemeById } from "../kittycordStudio/store";

const Invites = VencordNative?.pluginHelpers?.KittyInvites as PluginNative<typeof import("../kittyInvites/native")> | undefined;

const CODE_RE = /^[a-z0-9_-]{3,20}$/;

let pendingCode: string | null = null;
let wired = false;

async function claim(code: string) {
    if (friendConsumed({ kind: "claim", value: code })) return;
    const me = UserStore.getCurrentUser();
    if (!me) { pendingCode = code; return; }
    if (!Invites) { showToast("Invite codes work on the Kittycord desktop app.", Toasts.Type.FAILURE); return; }

    const status = await Invites.claim(me.id, code);
    if (status === "ok") { markFriendConsumed({ kind: "claim", value: code }); showToast("Invite claimed — your friend just got the credit. 🐱", Toasts.Type.SUCCESS); }
    else if (status === "rejected") showToast("That code couldn't be counted (already used, or it's your own).", Toasts.Type.MESSAGE);
    else showToast("Couldn't reach Kittycord to claim that code — try again later.", Toasts.Type.FAILURE);
}

async function openTheme(id: string) {
    showToast("Opening that theme…", Toasts.Type.MESSAGE);
    try {
        const theme = await applyGalleryThemeById(id);
        if (theme) showToast(`"${theme.name}" applied. 🎨`, Toasts.Type.SUCCESS);
        else showToast("That theme couldn't be found.", Toasts.Type.FAILURE);
    } catch {
        showToast("That theme couldn't be applied.", Toasts.Type.FAILURE);
    }
}

async function openPack(id: string) {
    showToast("Opening that command pack…", Toasts.Type.MESSAGE);
    try {
        await openPackImport(id);
    } catch {
        showToast("That command pack couldn't be opened.", Toasts.Type.FAILURE);
    }
}

function normalize(action: { kind: string; value: string; }): FriendAction | null {
    if (action.kind === "claim" && CODE_RE.test(action.value)) return { kind: "claim", value: action.value };
    if (action.kind === "theme") return { kind: "theme", value: action.value };
    if (action.kind === "pack") return { kind: "pack", value: action.value };
    return null;
}

async function handle(action: { kind: string; value: string; } | null) {
    if (!action) return;
    const friend = normalize(action);
    if (!friend) return;

    if (isPluginEnabled("Onboarding") && await onboardingPending()) {
        stashFriendAction(friend);
        return;
    }

    if (friend.kind === "claim") claim(friend.value);
    else if (friend.kind === "pack") openPack(friend.value);
    else openTheme(friend.value);
}

export default definePlugin({
    name: "DeepLinks",
    description: "Opens kittycord:// links in the client: claim a friend's invite code, open a shared theme or add a shared command pack with one click.",
    authors: [{ name: "Kittycord", id: 0n }],
    enabledByDefault: true,

    flux: {
        CONNECTION_OPEN() {
            if (pendingCode) {
                const code = pendingCode;
                pendingCode = null;
                claim(code);
            }
        }
    },

    start() {
        if (!wired) {
            VencordNative.kittycordDeepLinks.onLink(handle);
            wired = true;
        }
        VencordNative.kittycordDeepLinks.poll().then(handle);
    }
});
