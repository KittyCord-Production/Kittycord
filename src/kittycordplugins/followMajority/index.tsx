/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import type { VoiceState } from "@vencord/discord-types";
import { ChannelActions, ChannelStore, PermissionsBits, PermissionStore, SelectedChannelStore, showToast, Toasts, UserStore, VoiceStateStore } from "@webpack/common";

const MIN_OTHERS = 2;
const MIGRATION_WINDOW = 120_000;
const COOLDOWN = 10_000;

const settings = definePluginSettings({
    threshold: {
        type: OptionType.SLIDER,
        description: "Percentage of your channel that has to move before you follow.",
        markers: makeRange(50, 100, 5),
        default: 75,
        stickToMarkers: true
    }
});

let myChannelId: string | null = null;
const tracked = new Map<string, { where: string; since: number; }>();
let cooldownUntil = 0;

function rebuild(channelId: string) {
    tracked.clear();
    const meId = UserStore.getCurrentUser()?.id;
    const states = VoiceStateStore.getVoiceStatesForChannel(channelId);
    for (const userId of Object.keys(states)) {
        if (userId === meId || UserStore.getUser(userId)?.bot) continue;
        tracked.set(userId, { where: "here", since: 0 });
    }
}

export default definePlugin({
    name: "FollowMajority",
    description: "Automatically follows the crowd: when most of your voice channel moves somewhere else, you join them.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Voice"],
    settings,

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const current = SelectedChannelStore.getVoiceChannelId() ?? null;
            if (!current) {
                myChannelId = null;
                tracked.clear();
                return;
            }

            if (current !== myChannelId) {
                myChannelId = current;
                rebuild(current);
                return;
            }

            const meId = UserStore.getCurrentUser()?.id;
            for (const vs of voiceStates) {
                if (vs.userId === meId || UserStore.getUser(vs.userId)?.bot) continue;

                if (vs.channelId === myChannelId) {
                    tracked.set(vs.userId, { where: "here", since: 0 });
                } else if (tracked.has(vs.userId)) {
                    if (!vs.channelId) tracked.delete(vs.userId);
                    else tracked.set(vs.userId, { where: vs.channelId, since: Date.now() });
                }
            }

            const now = Date.now();
            for (const [userId, info] of tracked) {
                if (info.where !== "here" && now - info.since > MIGRATION_WINDOW) tracked.delete(userId);
            }

            if (now < cooldownUntil) return;

            const denominator = tracked.size;
            if (denominator < MIN_OTHERS) return;

            const tally = new Map<string, number>();
            for (const info of tracked.values()) {
                if (info.where === "here") continue;
                tally.set(info.where, (tally.get(info.where) ?? 0) + 1);
            }

            let bestDest: string | null = null;
            let bestCount = 0;
            for (const [dest, count] of tally) {
                if (count > bestCount) {
                    bestCount = count;
                    bestDest = dest;
                }
            }

            if (!bestDest || bestCount / denominator < settings.store.threshold / 100) return;

            const dest = ChannelStore.getChannel(bestDest);
            const myChannel = ChannelStore.getChannel(myChannelId);
            if (!dest || !myChannel || dest.guild_id !== myChannel.guild_id) return;
            if (!PermissionStore.can(PermissionsBits.CONNECT, dest)) return;

            cooldownUntil = now + COOLDOWN;
            ChannelActions.selectVoiceChannel(bestDest);
            showToast(`Followed your group to ${dest.name}.`, Toasts.Type.SUCCESS);
        }
    },

    start() {
        const current = SelectedChannelStore.getVoiceChannelId();
        if (current) {
            myChannelId = current;
            rebuild(current);
        }
    },

    stop() {
        tracked.clear();
        myChannelId = null;
        cooldownUntil = 0;
    }
});
