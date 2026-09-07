/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";
import { ContextMenuApi, Menu, React } from "@webpack/common";

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
    }
});

let isGhostActive = false;

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
                match: /self_mute:([^,]+),self_deaf:([^,]+),self_video:([^,]+)/,
                replace: "self_mute:$self.toggleMute($1),self_deaf:$self.toggleDeaf($2),self_video:$self.toggleVideo($3)"
            }
        }
    ],

    toggleMute(value: boolean) {
        return isGhostActive && settings.store.fakeMute ? true : value;
    },

    toggleDeaf(value: boolean) {
        return isGhostActive && settings.store.fakeDeafen ? true : value;
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
    ],
});
