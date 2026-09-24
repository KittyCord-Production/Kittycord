/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import { IS_WINDOWS } from "@utils/constants";
import definePlugin, { OptionType, type PluginNative } from "@utils/types";
import { findByCodeLazy, findByProps } from "@webpack";
import { ApplicationStreamingStore, ChannelStore, ContextMenuApi, MediaEngineStore, Menu, React, SelectedChannelStore } from "@webpack/common";

const Native = VencordNative?.pluginHelpers?.FakeVoice as PluginNative<typeof import("./native")> | undefined;
const startStream = findByCodeLazy('type:"STREAM_START"');
const stopStream = findByCodeLazy('type:"STREAM_STOP"');
const getDesktopSources = findByCodeLazy("desktop sources");

const settings = definePluginSettings({
    fakeMute: {
        type: OptionType.BOOLEAN,
        description: "Appear muted to everyone else.",
        default: true
    },
    fakeDeafen: {
        type: OptionType.BOOLEAN,
        description: "Appear deafened to everyone else.",
        default: true
    },
    fakeVideo: {
        type: OptionType.BOOLEAN,
        description: "Appear to have your camera on.",
        default: false
    },
    fakeUnmute: {
        type: OptionType.BOOLEAN,
        description: "Appear unmuted while you are really muted. Nobody hears you, you just look present.",
        default: false
    },
    fakeUndeafen: {
        type: OptionType.BOOLEAN,
        description: "Appear undeafened while you are really deafened.",
        default: false
    },
    fakeClips: {
        type: OptionType.BOOLEAN,
        description: "Show the clips icon, so people think you can clip the call.",
        default: false
    },
    fakeStream: {
        type: OptionType.BOOLEAN,
        description: "Go LIVE with a black screen instead of your real screen. Viewers see a real stream that shows nothing.",
        default: false,
        onChange: () => void refreshFakeStream()
    }
});

let isGhostActive = false;
const CLIPS_ENABLED = 1 << 0;
const BLACK_WINDOW_TITLE = "Kittycord Black Screen";
let fakeStreamActive = false;

function myStreamKey(): string | undefined {
    const s = ApplicationStreamingStore.getCurrentUserActiveStream();
    if (!s) return;
    return (s.guildId ? [s.streamType, s.guildId, s.channelId, s.ownerId] : [s.streamType, s.channelId, s.ownerId]).join(":");
}

// Streams a black window through Discord's normal Go Live, so viewers get a real stream with nothing in it.
async function refreshFakeStream() {
    const want = settings.store.fakeStream;
    const key = myStreamKey();

    if (!want) {
        if (key && fakeStreamActive) stopStream(key);
        fakeStreamActive = false;
        await Native?.closeBlackWindow();
        return;
    }

    const channelId = SelectedChannelStore.getVoiceChannelId();
    if (!channelId) return void showNotification({ title: "Fake Stream", body: "Join a voice channel first, then turn it on." });
    if (!Native) return void showNotification({ title: "Fake Stream", body: "Only works in the Discord desktop app." });
    if (key) stopStream(key);

    await Native.openBlackWindow();
    // the new window takes a moment to show up in the capture list
    let source: { id: string; name: string; } | undefined;
    for (let i = 0; i < 10 && !source; i++) {
        const sources: { id: string; name: string; }[] = await getDesktopSources(MediaEngineStore.getMediaEngine(), IS_WINDOWS, ["window"], null) ?? [];
        source = sources.find(s => s.name === BLACK_WINDOW_TITLE);
        if (!source) await new Promise(r => setTimeout(r, 300));
    }
    if (!source) {
        await Native.closeBlackWindow();
        settings.store.fakeStream = false;
        return void showNotification({ title: "Fake Stream", body: "Could not start the black screen. Try again." });
    }

    const channel = ChannelStore.getChannel(channelId);
    startStream(channel?.guild_id ?? null, channelId, {
        pid: null,
        sourceId: source.id,
        sourceName: source.name,
        audioSourceId: null,
        sound: false,
        previewDisabled: true
    });
    fakeStreamActive = true;
}

const getVoiceChannelId = (): string | undefined => findByProps("getVoiceChannelId")?.getVoiceChannelId?.();

const syncState = () => {
    const vm = findByProps("toggleSelfMute");
    if (vm && getVoiceChannelId()) {
        vm.toggleSelfMute();
        vm.toggleSelfMute();
    }
};

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
                    checked={settings.store.fakeMute && settings.store.fakeDeafen}
                    action={() => {
                        const nextState = !(settings.store.fakeMute && settings.store.fakeDeafen);
                        settings.store.fakeMute = nextState;
                        settings.store.fakeDeafen = nextState;
                        forceUpdate();
                    }}
                />
                <Menu.MenuSeparator />
                <Menu.MenuCheckboxItem
                    id="opt-mute"
                    label="Fake Mute"
                    checked={settings.store.fakeMute}
                    action={() => {
                        settings.store.fakeMute = !settings.store.fakeMute;
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-deafen"
                    label="Fake Deafen"
                    checked={settings.store.fakeDeafen}
                    action={() => {
                        settings.store.fakeDeafen = !settings.store.fakeDeafen;
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup label="Look present">
                <Menu.MenuCheckboxItem
                    id="opt-unmute"
                    label="Fake Unmute"
                    checked={settings.store.fakeUnmute}
                    action={() => {
                        settings.store.fakeUnmute = !settings.store.fakeUnmute;
                        syncState();
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-undeafen"
                    label="Fake Undeafen"
                    checked={settings.store.fakeUndeafen}
                    action={() => {
                        settings.store.fakeUndeafen = !settings.store.fakeUndeafen;
                        syncState();
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
            <Menu.MenuGroup label="Server-visible">
                <Menu.MenuCheckboxItem
                    id="opt-video"
                    label="Fake Camera"
                    checked={settings.store.fakeVideo}
                    action={() => {
                        settings.store.fakeVideo = !settings.store.fakeVideo;
                        syncState();
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-clips"
                    label="Fake Clips"
                    checked={settings.store.fakeClips}
                    action={() => {
                        settings.store.fakeClips = !settings.store.fakeClips;
                        syncState();
                        forceUpdate();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-stream"
                    label="Fake Stream (black screen)"
                    checked={settings.store.fakeStream}
                    action={() => {
                        settings.store.fakeStream = !settings.store.fakeStream;
                        forceUpdate();
                    }}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

function FakeDeafenUserButtonInner({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps) {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    return (
        <UserAreaButton
            onClick={() => {
                isGhostActive = !isGhostActive;
                syncState();
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

const FakeDeafenUserButton = ErrorBoundary.wrap(FakeDeafenUserButtonInner, { noop: true });

export default definePlugin({
    name: "FakeVoice",
    description: "Appear muted, deafened or with your camera on to others while you stay in control. Right-click the user-area button for options, or use /fakemute, /fakedeafen and /fakecamera.",
    authors: [{ name: "Kittycord", id: 0n }, { name: "mushzi", id: 449282863582412850n }],
    dependencies: ["CommandsAPI", "UserAreaAPI"],
    settings,

    patches: [
        {
            find: "}voiceStateUpdate(",
            replacement: {
                match: /self_mute:([^,]+),self_deaf:([^,]+),self_video:([^,]+),flags:([^}]+)\}/,
                replace: "self_mute:$self.toggleMute($1),self_deaf:$self.toggleDeaf($2),self_video:$self.toggleVideo($3),flags:$self.toggleFlags($4)}"
            }
        }
    ],

    // fake unmute wins over fake mute only for the part it covers, so deafen keeps working on its own
    toggleMute(value: boolean) {
        if (!isGhostActive) return value;
        if (settings.store.fakeUnmute) return false;
        return settings.store.fakeMute ? true : value;
    },

    toggleDeaf(value: boolean) {
        if (!isGhostActive) return value;
        if (settings.store.fakeUndeafen) return false;
        return settings.store.fakeDeafen ? true : value;
    },

    toggleFlags(value: number) {
        return isGhostActive && settings.store.fakeClips ? value | CLIPS_ENABLED : value;
    },

    toggleVideo(value: boolean) {
        return isGhostActive && settings.store.fakeVideo ? true : value;
    },

    userAreaButton: {
        icon: FakeDeafenIcon,
        render: props => <FakeDeafenUserButton {...props} />
    },

    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakemute",
            description: "Toggle Fake Mute",
            execute: async (_, ctx) => {
                settings.store.fakeMute = !settings.store.fakeMute;
                isGhostActive = settings.store.fakeMute;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Mute** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen",
            description: "Toggle Fake Deafen",
            execute: async (_, ctx) => {
                settings.store.fakeDeafen = !settings.store.fakeDeafen;
                isGhostActive = settings.store.fakeDeafen;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Deafen** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen_mute",
            description: "Toggle Fake Deafen & Mute at the same time",
            execute: async (_, ctx) => {
                const next = !(settings.store.fakeMute && settings.store.fakeDeafen);
                settings.store.fakeMute = next;
                settings.store.fakeDeafen = next;
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
                settings.store.fakeVideo = !settings.store.fakeVideo;
                isGhostActive = settings.store.fakeVideo;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Camera** is ${isGhostActive ? "enabled" : "disabled"}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakestream",
            description: "Toggle Fake Stream (go LIVE with a black screen)",
            execute: async (_, ctx) => {
                settings.store.fakeStream = !settings.store.fakeStream;
                sendBotMessage(ctx.channel.id, { content: `👻 **Fake Stream** is ${settings.store.fakeStream ? "enabled" : "disabled"}.` });
            },
        },
    ],

    flux: {
        // Discord ends every stream when you leave voice, so the setting and the black window follow along
        VOICE_CHANNEL_SELECT({ channelId }: { channelId: string | null; }) {
            if (!channelId && settings.store.fakeStream) settings.store.fakeStream = false;
        },
        STREAM_DELETE() {
            if (fakeStreamActive && !ApplicationStreamingStore.getCurrentUserActiveStream()) settings.store.fakeStream = false;
        }
    },

    stop() {
        if (settings.store.fakeStream) settings.store.fakeStream = false;
    }
});
