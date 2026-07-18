/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import type { Guild, MessageJSON, User } from "@vencord/discord-types";
import { FluxDispatcher, GuildMemberStore, Menu, RelationshipStore, showToast, Toasts, UserStore } from "@webpack/common";

const logger = new Logger("AntiPing");

const settings = definePluginSettings({
    suppressEveryone: {
        type: OptionType.BOOLEAN,
        description: "Hide @everyone and @here pings.",
        default: true
    },
    suppressRoles: {
        type: OptionType.BOOLEAN,
        description: "Hide role pings.",
        default: true
    },
    suppressDirect: {
        type: OptionType.BOOLEAN,
        description: "Hide direct @mentions.",
        default: true
    },
    friendsBypass: {
        type: OptionType.BOOLEAN,
        description: "Pings from friends always come through.",
        default: true
    },
    guildWhitelist: {
        type: OptionType.STRING,
        description: "Server IDs where pings stay visible. Right click a server to manage this.",
        default: ""
    },
    userWhitelist: {
        type: OptionType.STRING,
        description: "User IDs whose pings always come through. Right click a user to manage this.",
        default: ""
    }
}).withPrivateSettings<{ snoozeUntil: number; }>();

const SNOOZE_OPTIONS = [
    { label: "30 minutes", ms: 30 * 60_000 },
    { label: "1 hour", ms: 60 * 60_000 },
    { label: "4 hours", ms: 4 * 60 * 60_000 },
    { label: "8 hours", ms: 8 * 60 * 60_000 }
];

function parseList(raw: string): string[] {
    return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function hasId(raw: string, id: string): boolean {
    return parseList(raw).includes(id);
}

function toggleId(key: "guildWhitelist" | "userWhitelist", id: string): boolean {
    const list = parseList(settings.store[key]);
    const idx = list.indexOf(id);
    if (idx === -1) list.push(id);
    else list.splice(idx, 1);
    settings.store[key] = list.join(", ");
    return idx === -1;
}

function isSnoozing(): boolean {
    return Date.now() < (settings.store.snoozeUntil ?? 0);
}

function isBypassed(guildId: string, authorId: string): boolean {
    if (isSnoozing()) return false;
    if (hasId(settings.store.guildWhitelist, guildId)) return true;
    if (settings.store.friendsBypass && RelationshipStore.isFriend(authorId)) return true;
    if (hasId(settings.store.userWhitelist, authorId)) return true;
    return false;
}

function interceptor(event: { type: string; message?: MessageJSON; }) {
    try {
        if (event.type !== "MESSAGE_CREATE" && event.type !== "MESSAGE_UPDATE") return;

        const msg = event.message;
        if (!msg?.guild_id) return;

        const me = UserStore.getCurrentUser();
        const authorId = msg.author?.id;
        if (!me || !authorId || authorId === me.id) return;
        if (isBypassed(msg.guild_id, authorId)) return;

        if (settings.store.suppressEveryone) msg.mention_everyone = false;

        if (settings.store.suppressDirect && msg.mentions?.length)
            msg.mentions = msg.mentions.filter(u => u.id !== me.id);

        if (settings.store.suppressRoles && msg.mention_roles?.length) {
            const myRoles = GuildMemberStore.getMember(msg.guild_id, me.id)?.roles;
            if (myRoles?.length) msg.mention_roles = msg.mention_roles.filter(r => !myRoles.includes(r));
        }
    } catch (e) {
        logger.error("Failed to process message", e);
    }
}

const GuildContext: NavContextMenuPatchCallback = (children, { guild }: { guild?: Guild; }) => {
    if (!guild) return;

    const allowed = hasId(settings.store.guildWhitelist, guild.id);
    children.splice(-1, 0, (
        <Menu.MenuCheckboxItem
            id="vc-antiping-guild"
            label="Allow pings on this server"
            checked={allowed}
            action={() => {
                const added = toggleId("guildWhitelist", guild.id);
                showToast(added ? "Pings on this server will come through." : "Pings on this server are hidden again.", Toasts.Type.SUCCESS);
            }}
        />
    ));
};

const UserContext: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user || user.id === UserStore.getCurrentUser()?.id) return;

    const allowed = hasId(settings.store.userWhitelist, user.id);
    children.splice(-1, 0, (
        <Menu.MenuCheckboxItem
            id="vc-antiping-user"
            label="Always allow their pings"
            checked={allowed}
            action={() => {
                const added = toggleId("userWhitelist", user.id);
                showToast(added ? "Their pings will always come through." : "Their pings follow your normal settings again.", Toasts.Type.SUCCESS);
            }}
        />
    ));
};

export default definePlugin({
    name: "AntiPing",
    description: "Hides ping badges, sounds and popups on servers instead of muting them. Whitelist servers or people, let friends through, or snooze everything for a while.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Notifications"],
    settings,

    contextMenus: {
        "guild-context": GuildContext,
        "user-context": UserContext
    },

    toolboxActions() {
        const remaining = (settings.store.snoozeUntil ?? 0) - Date.now();
        return (
            <Menu.MenuItem id="vc-antiping-snooze" label="AntiPing Snooze">
                {remaining > 0 && (
                    <Menu.MenuItem
                        id="vc-antiping-snooze-end"
                        label={`End snooze (${Math.ceil(remaining / 60_000)}m left)`}
                        action={() => {
                            settings.store.snoozeUntil = 0;
                            showToast("Snooze ended.", Toasts.Type.SUCCESS);
                        }}
                    />
                )}
                {SNOOZE_OPTIONS.map(option => (
                    <Menu.MenuItem
                        key={option.label}
                        id={`vc-antiping-snooze-${option.ms}`}
                        label={option.label}
                        action={() => {
                            settings.store.snoozeUntil = Date.now() + option.ms;
                            showToast(`All pings snoozed for ${option.label}.`, Toasts.Type.SUCCESS);
                        }}
                    />
                ))}
            </Menu.MenuItem>
        );
    },

    start() {
        FluxDispatcher.addInterceptor(interceptor);
    },

    stop() {
        const list = FluxDispatcher._interceptors ?? [];
        const idx = list.indexOf(interceptor);
        if (idx !== -1) list.splice(idx, 1);
    }
});
