/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Guild } from "@vencord/discord-types";
import { GuildStore, Menu, PermissionsBits, PermissionStore, SelectedGuildStore, showToast, Toasts } from "@webpack/common";

import { findKitLink, sanitizeKit, ServerKit } from "./kit";
import { openKitStudio } from "./KitStudioModal";
import { kitsAvailable, Native } from "./native-bridge";
import { openOfferModal } from "./OfferModal";

const logger = new Logger("ServerKits");
const SEEN_KEY = "Kittycord_KitsSeen";

type Decision = string;

let seen: Record<string, Decision> = {};
let checking = false;

const settings = definePluginSettings({
    offerKits: {
        type: OptionType.BOOLEAN,
        description: "Offer a server's kit when you open a server that has one",
        default: true
    }
});

async function loadSeen() {
    seen = (await get<Record<string, Decision>>(SEEN_KEY)) ?? {};
}

function remember(guildId: string, decision: Decision) {
    seen = { ...seen, [guildId]: decision };
    set(SEEN_KEY, seen);
}

export async function fetchKit(id: string): Promise<ServerKit | null> {
    if (!Native) return null;

    try {
        return sanitizeKit(await Native.getKit(id));
    } catch (err) {
        logger.warn("Could not load that kit", err);
        return null;
    }
}

async function checkGuild(guildId: string | null) {
    if (!guildId || checking || !settings.store.offerKits || !Native) return;

    const guild = GuildStore.getGuild(guildId);
    if (!guild?.description) return;

    const kitId = findKitLink(guild.description);
    if (!kitId) return;

    const decision = seen[guildId];
    if (decision === "never" || decision === kitId) return;

    checking = true;
    try {
        const kit = await fetchKit(kitId);
        if (!kit) return;

        openOfferModal(kit, choice => remember(guildId, choice === "later" ? "" : choice === "never" ? "never" : kitId));
    } finally {
        checking = false;
    }
}

function kitMenuItem(guild: Guild) {
    return (
        <Menu.MenuItem
            id="kc-server-kit"
            label="Create server kit"
            action={() => openKitStudio(guild)}
        />
    );
}

export default definePlugin({
    name: "ServerKits",
    description: "A server can hand its members a ready-made setup: a theme, chat commands, notification sounds and the plugins it recommends.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    settings,

    contextMenus: {
        "guild-context"(children, { guild }: { guild?: Guild; }) {
            if (!guild || !kitsAvailable()) return;
            if (!PermissionStore.can(PermissionsBits.MANAGE_GUILD, guild)) return;

            children.push(kitMenuItem(guild));
        }
    },

    flux: {
        CHANNEL_SELECT({ guildId }: { guildId: string | null; }) {
            checkGuild(guildId);
        }
    },

    toolboxActions: {
        "Create a server kit"() {
            const guildId = SelectedGuildStore.getGuildId();
            const guild = guildId ? GuildStore.getGuild(guildId) : null;

            if (!guild) return showToast("Open the server you want to build a kit for first.", Toasts.Type.FAILURE);
            if (!PermissionStore.can(PermissionsBits.MANAGE_GUILD, guild))
                return showToast("Only someone who can manage the server can publish its kit.", Toasts.Type.FAILURE);

            openKitStudio(guild);
        }
    },

    async start() {
        await loadSeen();
    }
});
