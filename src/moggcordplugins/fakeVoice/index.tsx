/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to Kittycord and audited (clean: local voice-state patch + local Flux dispatch only, no network/token/eval).
// Original author kept as inline credit.

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import definePlugin from "@utils/types";
import { findByProps } from "@webpack";
import { ContextMenuApi, FluxDispatcher, Menu, React, UserStore } from "@webpack/common";

let isGhostActive = false;
let configFakeMute = true;
let configFakeDeafen = true;
let configFakeVideo = false;
let configFakeLive = false;
let configFakeSpeaking = false;

const SPEAKING_VOICE = 1 << 0;
let speakingTimer: ReturnType<typeof setInterval> | null = null;

const getVoiceChannelId = (): string | undefined => findByProps("getVoiceChannelId")?.getVoiceChannelId?.();

const syncState = () => {
    const vm = findByProps("toggleSelfMute");
    if (vm && getVoiceChannelId()) {
        vm.toggleSelfMute();
        vm.toggleSelfMute();
    }
};

function refreshSpeaking() {
    const shouldRun = isGhostActive && configFakeSpeaking;
    if (shouldRun && !speakingTimer) {
        speakingTimer = setInterval(() => {
            const id = UserStore.getCurrentUser()?.id;
            const channelId = getVoiceChannelId();
            if (!id || !channelId) return;
            FluxDispatcher.dispatch({ type: "SPEAKING", userId: id, speakingFlags: SPEAKING_VOICE, context: channelId });
        }, 250);
    } else if (!shouldRun && speakingTimer) {
        clearInterval(speakingTimer);
        speakingTimer = null;
    }
}

function FakeDeafenIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C7.58 2 4 5.58 4 10V19C4 20.66 5.34 22 7 22C8.66 22 10 20.66 10 19C10 20.66 11.34 22 13 22C14.66 22 16 20.66 16 19C16 20.66 17.34 22 19 22C20.66 22 22 20.66 22 19V10C22 5.58 18.42 2 14 2H10H12Z" fill="currentColor" />
            <circle cx="8.5" cy="10" r="1.5" fill={isGhostActive ? "#121212" : "black"} fillOpacity="0.6" />
            <circle cx="15.5" cy="10" r="1.5" fill={isGhostActive ? "#121212" : "black"} fillOpacity="0.6" />
            {isGhostActive && (
                <path d="M2 2L22 22" stroke="#ed4245" strokeWidth="2.5" strokeLinecap="round" />
            )}
        </svg>
    );
}

function GhostContextMenu() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    return (
        <Menu.Menu navId="fake-voice-menu" onClose={() => ContextMenuApi.closeContextMenu()} aria-label="Fake Voice Configuration">
            <Menu.MenuGroup label="Ghost Options">
                <Menu.MenuCheckboxItem
                    id="opt-both"
                    label="Fake Mute & Deafen"
                    checked={configFakeMute && configFakeDeafen}
                    action={() => {
                        const nextState = !(configFakeMute && configFakeDeafen);
                        configFakeMute = nextState;
                        configFakeDeafen = nextState;
                        forceUpdate();
                    }}
                />
                <Menu.MenuSeparator />
                <Menu.MenuCheckboxItem
                    id="opt-mute"
                    label="Fake Mute"
                    checked={configFakeMute}
                    action={() => {
                        configFakeMute = !configFakeMute;
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-deafen"
                    label="Fake Deafen"
                    checked={configFakeDeafen}
                    action={() => {
                        configFakeDeafen = !configFakeDeafen;
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup label="Server-visible">
                <Menu.MenuCheckboxItem
                    id="opt-video"
                    label="Fake Camera"
                    checked={configFakeVideo}
                    action={() => {
                        configFakeVideo = !configFakeVideo;
                        syncState();
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup label="Experimental — may only show to you">
                <Menu.MenuCheckboxItem
                    id="opt-live"
                    label="Fake Live"
                    checked={configFakeLive}
                    action={() => {
                        configFakeLive = !configFakeLive;
                        syncState();
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-speaking"
                    label="Fake Speaking"
                    checked={configFakeSpeaking}
                    action={() => {
                        configFakeSpeaking = !configFakeSpeaking;
                        refreshSpeaking();
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

function FakeDeafenUserButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    return (
        <UserAreaButton
            onClick={() => {
                isGhostActive = !isGhostActive;
                syncState();
                refreshSpeaking();
                forceUpdate();
            }}
            onContextMenu={(e: React.MouseEvent) => ContextMenuApi.openContextMenu(e, () => <GhostContextMenu />)}
            tooltipText={hideTooltips ? undefined : isGhostActive ? "Disable Fake Voice" : "Enable Fake Voice (right click: config)"}
            icon={<FakeDeafenIcon className={iconForeground} />}
            role="switch"
            aria-checked={isGhostActive}
            redGlow={false}
            plated={nameplate != null}
        />
    );
}

export default definePlugin({
    name: "FakeVoice",
    description: "Appear muted, deafened or with your camera on to others while you stay in control. Right-click the user-area button for options (camera shows to everyone; live & speaking are experimental). Also /fakemute and /fakedeafen.",
    authors: [{ name: "Kittycord", id: 0n }, { name: "mushzi", id: 449282863582412850n }],
    dependencies: ["CommandsAPI", "UserAreaAPI"],

    patches: [
        {
            find: "}voiceStateUpdate(",
            replacement: {
                match: /self_mute:([^,]+),self_deaf:([^,]+),self_video:([^,]+)/,
                replace: "self_mute:$self.toggle($1,'mute'),self_deaf:$self.toggle($2,'deaf'),self_video:$self.toggle($3,'video')"
            }
        },
        {
            find: "}voiceStateUpdate(",
            replacement: {
                match: /self_stream:([^,}]+)/,
                replace: "self_stream:$self.toggle($1,'stream')",
                noWarn: true
            }
        }
    ],

    toggle(val: any, what: string) {
        if (!isGhostActive) return val;
        switch (what) {
            case "mute": return configFakeMute ? true : val;
            case "deaf": return configFakeDeafen ? true : val;
            case "video": return configFakeVideo ? true : val;
            case "stream": return configFakeLive ? true : val;
            default: return val;
        }
    },

    userAreaButton: {
        icon: FakeDeafenIcon,
        render: FakeDeafenUserButton
    },

    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakemute",
            description: "Toggle Fake Mute",
            execute: async (_, ctx) => {
                configFakeMute = !configFakeMute;
                isGhostActive = configFakeMute;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Mute** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen",
            description: "Toggle Fake Deafen",
            execute: async (_, ctx) => {
                configFakeDeafen = !configFakeDeafen;
                isGhostActive = configFakeDeafen;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Deafen** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen_mute",
            description: "Toggle Fake Deafen & Mute at the same time",
            execute: async (_, ctx) => {
                const next = !(configFakeMute && configFakeDeafen);
                configFakeMute = next;
                configFakeDeafen = next;
                isGhostActive = next;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Deafen & Mute** are ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakecamera",
            description: "Toggle Fake Camera (appear camera-on to everyone)",
            execute: async (_, ctx) => {
                configFakeVideo = !configFakeVideo;
                isGhostActive = configFakeVideo;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Camera** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
    ],

    stop() {
        if (speakingTimer) clearInterval(speakingTimer);
        speakingTimer = null;
        isGhostActive = false;
    }
});
