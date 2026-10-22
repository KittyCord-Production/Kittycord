/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { getKittyAuth } from "@kittycordplugins/_shared/kittyAuth";
import definePlugin, { type PluginNative } from "@utils/types";
import { Alerts, showToast, UserStore } from "@webpack/common";

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
    if (!Invites) { showToast({ text: "Invite codes work on the Kittycord desktop app.", variant: "critical" }); return; }

    Alerts.show({
        title: "Claim this invite code?",
        body: `The person behind the code "${code}" gets the credit for inviting you. You can only do this once.`,
        confirmText: "Claim",
        cancelText: "Cancel",
        onConfirm: () => sendClaim(code)
    });
}

async function sendClaim(code: string) {
    const me = UserStore.getCurrentUser();
    if (!me || !Invites) return;
    const auth = await getKittyAuth();
    if (!auth) return;
    const status = await Invites.claim(me.id, code, auth);
    if (status === "ok") { markFriendConsumed({ kind: "claim", value: code }); showToast({ text: "Invite claimed — your friend just got the credit. 🐱", variant: "success" }); }
    else if (status === "rejected") showToast({ text: "That code couldn't be counted (already used, or it's your own)." });
    else showToast({ text: "Couldn't reach Kittycord to claim that code — try again later.", variant: "critical" });
}

function openTheme(id: string) {
    Alerts.show({
        title: "Apply this theme?",
        body: "A theme someone shared with you will be installed and turned on. You can turn it off again under Themes.",
        confirmText: "Apply",
        cancelText: "Cancel",
        onConfirm: () => applyTheme(id)
    });
}

async function applyTheme(id: string) {
    showToast({ text: "Opening that theme…" });
    try {
        const theme = await applyGalleryThemeById(id);
        if (theme) showToast({ text: `"${theme.name}" applied. 🎨`, variant: "success" });
        else showToast({ text: "That theme couldn't be found.", variant: "critical" });
    } catch {
        showToast({ text: "That theme couldn't be applied.", variant: "critical" });
    }
}

async function openPack(id: string) {
    showToast({ text: "Opening that command pack…" });
    try {
        await openPackImport(id);
    } catch {
        showToast({ text: "That command pack couldn't be opened.", variant: "critical" });
    }
}

async function openKit(id: string) {
    showToast({ text: "Opening that server kit…" });
    const { fetchKit } = await import("../serverKits");
    const kit = await fetchKit(id);

    if (!kit) return showToast({ text: "That server kit couldn't be opened.", variant: "critical" });

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
