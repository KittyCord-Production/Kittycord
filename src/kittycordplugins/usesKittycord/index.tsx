/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { Logger } from "@utils/Logger";
import definePlugin, { type PluginNative } from "@utils/types";
import { UserStore } from "@webpack/common";

import { BRAND_BADGE_ICON } from "../../branding";

const Native = VencordNative?.pluginHelpers?.UsesKittycord as PluginNative<typeof import("./native")> | undefined;
const logger = new Logger("UsesKittycord");

const kittycordUsers = new Set<string>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const UsesKittycordBadge: ProfileBadge = {
    id: "uses-kittycord",
    description: "Uses Kittycord",
    iconSrc: BRAND_BADGE_ICON,
    position: BadgePosition.END,
    shouldShow: ({ userId }) => kittycordUsers.has(userId)
};

async function refresh() {
    if (!Native) return;
    const users = await Native.getUsers();
    kittycordUsers.clear();
    for (const id of users) kittycordUsers.add(id);
}

export default definePlugin({
    name: "UsesKittycord",
    description: "Shows a 🐱 “Uses Kittycord” badge on everyone who uses Kittycord, so you can spot each other anywhere on Discord.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Customisation"],
    enabledByDefault: true,

    async start() {
        addProfileBadge(UsesKittycordBadge);
        try {
            const me = UserStore.getCurrentUser();
            if (me && Native) {
                kittycordUsers.add(me.id);
                await Native.announce(me.id);
            }
            await refresh();
            refreshTimer = setInterval(refresh, 10 * 60 * 1000);
        } catch (e) {
            logger.error("init failed", e);
        }
    },

    stop() {
        removeProfileBadge(UsesKittycordBadge);
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        kittycordUsers.clear();
    }
});
