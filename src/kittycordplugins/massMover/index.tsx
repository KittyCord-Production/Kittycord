/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import type { Channel } from "@vencord/discord-types";
import { GuildChannelStore, GuildMemberStore, GuildRoleStore, Menu, PermissionsBits, PermissionStore, RestAPI, showToast, Toasts, VoiceStateStore } from "@webpack/common";

const logger = new Logger("MassMover");

const settings = definePluginSettings({
    moveDelay: {
        type: OptionType.SLIDER,
        description: "Seconds to wait between each move to avoid rate limits.",
        markers: makeRange(0, 3, 0.25),
        default: 0.5,
        stickToMarkers: false
    }
});

function getVoiceUsers(target: Channel): string[] {
    const guildChannels: { VOCAL: { channel: Channel; }[]; } = GuildChannelStore.getChannels(target.guild_id);
    return guildChannels.VOCAL
        .map(({ channel }) => channel)
        .filter(channel => channel.id !== target.id)
        .flatMap(channel => Object.keys(VoiceStateStore.getVoiceStatesForChannel(channel.id)));
}

async function moveUsers(guildId: string, userIds: string[], targetId: string) {
    const { moveDelay } = settings.store;
    let moved = 0;

    for (const userId of userIds) {
        try {
            await RestAPI.patch({
                url: `/guilds/${guildId}/members/${userId}`,
                body: { channel_id: targetId }
            });
            moved++;
        } catch (e) {
            logger.error(`Failed to move ${userId}`, e);
        }
        if (moveDelay) await sleep(moveDelay * 1000);
    }

    showToast(`Moved ${moved} of ${userIds.length} users.`, moved ? Toasts.Type.SUCCESS : Toasts.Type.FAILURE);
}

const ChannelContext: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (!channel || (channel.type !== 2 && channel.type !== 13)) return;
    if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, channel)) return;

    const users = getVoiceUsers(channel);
    if (!users.length) return;

    const roleIds = new Set<string>();
    for (const userId of users)
        GuildMemberStore.getMember(channel.guild_id, userId)?.roles.forEach(id => roleIds.add(id));
    const roles = GuildRoleStore.getSortedRoles(channel.guild_id).filter(role => roleIds.has(role.id));

    children.splice(-1, 0, (
        <Menu.MenuItem id="vc-mass-move" label="Mass Move">
            <Menu.MenuItem
                id="vc-mass-move-everyone"
                label={`Move everyone here (${users.length})`}
                action={() => void moveUsers(channel.guild_id, users, channel.id)}
            />
            {roles.length > 0 && (
                <Menu.MenuItem id="vc-mass-move-role" label="Move role here">
                    {roles.map(role => (
                        <Menu.MenuItem
                            key={role.id}
                            id={`vc-mass-move-role-${role.id}`}
                            label={role.name}
                            action={() => void moveUsers(
                                channel.guild_id,
                                users.filter(userId => GuildMemberStore.getMember(channel.guild_id, userId)?.roles.includes(role.id)),
                                channel.id
                            )}
                        />
                    ))}
                </Menu.MenuItem>
            )}
        </Menu.MenuItem>
    ));
};

export default definePlugin({
    name: "MassMover",
    description: "Right click a voice channel to pull everyone, or everyone with a certain role, from the whole server into it.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Voice", "Servers"],
    settings,

    contextMenus: {
        "channel-context": ChannelContext
    }
});
