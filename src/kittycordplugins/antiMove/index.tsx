/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { VoiceState } from "@vencord/discord-types";
import { ChannelActions, ChannelStore, SelectedChannelStore, showToast, Toasts, UserStore } from "@webpack/common";

let intendedChannelId: string | null = null;
let rejoinTimes: number[] = [];

export default definePlugin({
    name: "AntiMove",
    description: "Instantly moves you back to your voice channel when someone drags you somewhere else.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Voice"],

    flux: {
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            if (channelId !== intendedChannelId) rejoinTimes = [];
            intendedChannelId = channelId;
        },

        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            const me = UserStore.getCurrentUser();
            if (!me) return;

            const myState = voiceStates.find(s => s.userId === me.id);
            if (!myState) return;

            if (!myState.channelId) {
                intendedChannelId = null;
                rejoinTimes = [];
                return;
            }

            if (!intendedChannelId || myState.channelId === intendedChannelId) return;

            if (!ChannelStore.getChannel(intendedChannelId)) {
                intendedChannelId = myState.channelId;
                return;
            }

            rejoinTimes = rejoinTimes.filter(t => Date.now() - t < 10_000);
            if (rejoinTimes.length >= 3) {
                intendedChannelId = myState.channelId;
                showToast("Stopped moving you back after repeated moves.", Toasts.Type.FAILURE);
                return;
            }
            rejoinTimes.push(Date.now());

            ChannelActions.selectVoiceChannel(intendedChannelId);
            showToast("Moved you back to your channel.", Toasts.Type.SUCCESS);
        }
    },

    start() {
        intendedChannelId = SelectedChannelStore.getVoiceChannelId() ?? null;
    },

    stop() {
        intendedChannelId = null;
        rejoinTimes = [];
    }
});
