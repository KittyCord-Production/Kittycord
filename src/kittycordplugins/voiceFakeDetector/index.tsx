/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { useForceUpdater } from "@utils/react";
import definePlugin, { OptionType } from "@utils/types";
import { User } from "@vencord/discord-types";
import { FluxDispatcher, React, Tooltip, UserStore, VoiceStateStore } from "@webpack/common";

interface FakeState {
    mute: boolean;
    deaf: boolean;
}

const caught = new Map<string, FakeState>();
const updaters = new Set<() => void>();

function rerender() {
    updaters.forEach(update => update());
}

function label({ mute, deaf }: FakeState) {
    if (mute && deaf) return "Faking mute & deafen";
    if (deaf) return "Faking deafen";
    return "Faking mute";
}

function announce(userId: string, state: FakeState) {
    if (!settings.store.notify) return;
    const user = UserStore.getUser(userId);
    const name = user?.globalName ?? user?.username ?? "Someone";
    showNotification({
        title: "FakeVoice caught",
        body: `${name} is ${label(state).toLowerCase()} but still talking.`,
        icon: user?.getAvatarURL?.(),
        color: "#ff5fa6"
    });
}

function mark(userId: string, state: FakeState) {
    const prev = caught.get(userId);
    if (prev && prev.mute === state.mute && prev.deaf === state.deaf) return;
    caught.set(userId, state);
    if (!prev) announce(userId, state);
    rerender();
}

function clear(userId: string) {
    if (caught.delete(userId)) rerender();
}

const SPEAKING_VOICE = 1 << 0;

function onSpeaking({ userId, speakingFlags }: { userId: string; speakingFlags: number; }) {
    if (!(speakingFlags & SPEAKING_VOICE) || userId === UserStore.getCurrentUser()?.id) return;

    const voiceState = VoiceStateStore.getVoiceStateForUser(userId);
    if (!voiceState?.channelId) return;

    if (voiceState.selfMute || voiceState.selfDeaf)
        mark(userId, { mute: !!voiceState.selfMute, deaf: !!voiceState.selfDeaf });
}

function onVoiceStateUpdates({ voiceStates }: { voiceStates: Array<{ userId: string; channelId?: string | null; selfMute?: boolean; selfDeaf?: boolean; }>; }) {
    for (const voiceState of voiceStates) {
        if (!caught.has(voiceState.userId)) continue;

        if (!voiceState.channelId || (!voiceState.selfMute && !voiceState.selfDeaf))
            clear(voiceState.userId);
        else
            mark(voiceState.userId, { mute: !!voiceState.selfMute, deaf: !!voiceState.selfDeaf });
    }
}

function FakeIndicator({ userId, small }: { userId: string; small?: boolean; }) {
    const update = useForceUpdater();

    React.useEffect(() => {
        updaters.add(update);
        return () => void updaters.delete(update);
    }, [update]);

    const state = caught.get(userId);
    if (!state) return null;

    const size = small ? 16 : 18;

    return (
        <Tooltip text={label(state)}>
            {props => (
                <svg
                    {...props}
                    className="kc-fakevoice-indicator"
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-label={label(state)}
                >
                    <path d="M12 2C7.58 2 4 5.58 4 10v10.4c0 .53.64.8 1.02.42l1.6-1.6a.6.6 0 0 1 .85 0l1.45 1.45c.23.24.62.24.85 0l1.45-1.45a.6.6 0 0 1 .85 0l1.45 1.45c.24.24.62.24.86 0l1.44-1.45a.6.6 0 0 1 .86 0l1.6 1.6c.37.38 1.01.11 1.01-.42V10c0-4.42-3.58-8-8-8Z" />
                    <circle cx="9" cy="10.5" r="1.4" fill="#1a0e14" />
                    <circle cx="15" cy="10.5" r="1.4" fill="#1a0e14" />
                </svg>
            )}
        </Tooltip>
    );
}

const settings = definePluginSettings({
    voiceRows: {
        type: OptionType.BOOLEAN,
        description: "Show the indicator in voice channel user lists",
        default: true,
        restartNeeded: true
    },
    memberList: {
        type: OptionType.BOOLEAN,
        description: "Show the indicator next to names in the member list",
        default: true
    },
    profiles: {
        type: OptionType.BOOLEAN,
        description: "Show the indicator in user profiles",
        default: true
    },
    notify: {
        type: OptionType.BOOLEAN,
        description: "Send a notification the first time someone is caught faking",
        default: true
    }
});

export default definePlugin({
    name: "VoiceFakeDetector",
    description: "Flags people in your voice channel who appear muted or deafened but are still transmitting audio (e.g. a fake-voice plugin). Catches them the moment they talk; the mark clears when they leave or genuinely unmute.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["MemberListDecoratorsAPI", "NicknameIconsAPI"],
    tags: ["Voice", "Utility"],
    settings,

    patches: [
        {
            find: "#{intl::GUEST_NAME_SUFFIX})]",
            predicate: () => settings.store.voiceRows,
            replacement: {
                match: /(#{intl::GUEST_NAME_SUFFIX}.{0,50}?"".{0,100})\](?=\}\))(?<=user:(\i).+?)/,
                replace: "$1,$self.renderVoiceRow($2?.id)]"
            }
        }
    ],

    renderVoiceRow: (userId?: string) =>
        userId ? <FakeIndicator userId={userId} small /> : null,

    renderMemberListDecorator: ({ user }: { user?: User; }) =>
        settings.store.memberList && user ? <FakeIndicator userId={user.id} small /> : null,

    renderNicknameIcon: ({ userId }: { userId: string; }) =>
        settings.store.profiles ? <FakeIndicator userId={userId} /> : null,

    start() {
        FluxDispatcher.subscribe("SPEAKING", onSpeaking);
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdates);
    },

    stop() {
        FluxDispatcher.unsubscribe("SPEAKING", onSpeaking);
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdates);
        caught.clear();
        rerender();
    }
});
