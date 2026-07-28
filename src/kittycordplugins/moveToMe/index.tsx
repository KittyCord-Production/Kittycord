/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { ChannelStore, Menu, PermissionsBits, PermissionStore, RestAPI, SelectedChannelStore, showToast, Toasts, VoiceStateStore } from "@webpack/common";

const logger = new Logger("MoveToMe");

async function moveToMe(guildId: string, user: User, channelId: string) {
    try {
        await RestAPI.patch({
            url: `/guilds/${guildId}/members/${user.id}`,
            body: { channel_id: channelId }
        });
        showToast(`Moved ${user.username} to your channel.`, Toasts.Type.SUCCESS);
    } catch (e) {
        logger.error(`Failed to move ${user.id}`, e);
        showToast(`Could not move ${user.username}.`, Toasts.Type.FAILURE);
    }
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user) return;

    const myChannelId = SelectedChannelStore.getVoiceChannelId();
    if (!myChannelId) return;

    const myChannel = ChannelStore.getChannel(myChannelId);
    const theirChannelId = VoiceStateStore.getUserVoiceChannelId(myChannel.guild_id, user.id);
    if (!theirChannelId || theirChannelId === myChannelId) return;

    if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, myChannel)) return;
    if (!PermissionStore.can(PermissionsBits.MOVE_MEMBERS, ChannelStore.getChannel(theirChannelId))) return;

    const item = (
        <Menu.MenuItem
            id="kc-move-to-me"
            label="Move to my channel"
            action={() => void moveToMe(myChannel.guild_id, user, myChannelId)}
        />
    );

    const group = findGroupChildrenByChildId("roles", children);
    if (group) group.push(item);
    else children.splice(-1, 0, item);
};

export default definePlugin({
    name: "MoveToMe",
    description: "Adds a right click option to pull someone from another voice channel into the one you are in.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Voice", "Servers"],

    contextMenus: {
        "user-context": UserContext
    }
});
