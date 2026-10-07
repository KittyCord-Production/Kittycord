/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import definePlugin, { type PluginNative } from "@utils/types";
import { showToast, UserStore } from "@webpack/common";

import { type FriendAction, friendConsumed, markFriendConsumed, onboardingPending, stashFriendAction } from "../_shared/friendLink";
import { openPackImport } from "../commandStudio/PackGallery";
import { applyGalleryThemeById } from "../kittycordStudio/store";

const Invites = VencordNative?.pluginHelpers?.KittyInvites as PluginNative<typeof import("../kittyInvites/native")> | undefined;

const CODE_RE = /^[a-z0-9_-]{3,20}$/;

let pendingCode: string | null = null;
let unsubscribe: (() => void) | null = null;

async function claim(code: string) {
    if (friendConsumed({ kind: "claim", value: code })) return;
    const me = UserStore.getCurrentUser();
    if (!me) { pendingCode = code; return; }
    if (!Invites) { showToast("Invite codes work on the Kittycord desktop app.", "failure"); return; }

    const status = await Invites.claim(me.id, code);
    if (status === "ok") { markFriendConsumed({ kind: "claim", value: code }); showToast("Invite claimed — your friend just got the credit. 🐱", "success"); }
    else if (status === "rejected") showToast("That code couldn't be counted (already used, or it's your own).", "message");
    else showToast("Couldn't reach Kittycord to claim that code — try again later.", "failure");
}

async function openTheme(id: string) {
    showToast("Opening that theme…", "message");
    try {
        const theme = await applyGalleryThemeById(id);
        if (theme) showToast(`"${theme.name}" applied. 🎨`, "success");
        else showToast("That theme couldn't be found.", "failure");
    } catch {
        showToast("That theme couldn't be applied.", "failure");
    }
}

async function openPack(id: string) {
    showToast("Opening that command pack…", "message");
    try {
        await openPackImport(id);
    } catch {
        showToast("That command pack couldn't be opened.", "failure");
    }
}

async function openKit(id: string) {
    showToast("Opening that server kit…", "message");
    const { fetchKit } = await import("../serverKits");
    const kit = await fetchKit(id);

    if (!kit) return showToast("That server kit couldn't be opened.", "failure");

    const { openOfferModal } = await import("../serverKits/OfferModal");
    openOfferModal(kit, () => { });
}

function normalize(action: { kind: string; value: string; }): FriendAction | null {
    if (action.kind === "claim" && CODE_RE.test(action.value)) return { kind: "claim", value: action.value };
    if (action.kind === "theme") return { kind: "theme", value: action.value };
    if (action.kind === "pack") return { kind: "pack", value: action.value };
    if (action.kind === "kit") return { kind: "kit", value: action.value };
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
    else if (friend.kind === "kit") openKit(friend.value);
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
        unsubscribe = VencordNative.kittycordDeepLinks.onLink(handle);
        VencordNative.kittycordDeepLinks.poll().then(handle);
    },

    stop() {
        unsubscribe?.();
        unsubscribe = null;
        pendingCode = null;
    }
});
