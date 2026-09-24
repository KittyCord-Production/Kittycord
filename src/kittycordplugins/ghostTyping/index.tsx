/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { React } from "@webpack/common";

const TypingActions = findByPropsLazy("startTyping", "stopTyping");

const active = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function ping() {
    for (const id of active) TypingActions?.startTyping?.(id);
}

function refreshTimer() {
    if (active.size && !timer) {
        ping();
        timer = setInterval(ping, 8000);
    } else if (!active.size && timer) {
        clearInterval(timer);
        timer = null;
    }
}

function toggle(channelId: string) {
    if (active.has(channelId)) {
        active.delete(channelId);
        TypingActions?.stopTyping?.(channelId);
    } else {
        active.add(channelId);
    }
    refreshTimer();
    listeners.forEach(l => l());
}

function stopAll() {
    if (timer) clearInterval(timer);
    timer = null;
    for (const id of active) TypingActions?.stopTyping?.(id);
    active.clear();
    listeners.forEach(l => l());
}

function GhostTypingIcon({ active: on }: { active?: boolean; }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="5" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
            <circle cx="8" cy="12" r="1.4" fill="currentColor" />
            <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            <circle cx="16" cy="12" r="1.4" fill="currentColor" />
            {on && <circle cx="19.5" cy="6" r="3" fill="var(--brand-500)" stroke="var(--background-primary)" strokeWidth="1.5" />}
        </svg>
    );
}

function GhostTypingChatIcon() {
    return <GhostTypingIcon />;
}

const GhostTypingButton: ChatBarButtonFactory = ({ channel }) => {
    const [, force] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
        listeners.add(force);
        return () => void listeners.delete(force);
    }, []);

    const on = active.has(channel.id);

    return (
        <ChatBarButton
            tooltip={on ? "Ghost Typing: on — everyone sees you typing" : "Ghost Typing: appear to type forever"}
            onClick={() => toggle(channel.id)}
        >
            <GhostTypingIcon active={on} />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "GhostTyping",
    description: "Appear to be typing forever in a channel — everyone there keeps seeing your \"is typing…\" indicator until you switch it off. Toggle from the chat bar or with /ghosttyping. Not recommended: Discord can flag accounts that automate actions, so use it at your own risk.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["CommandsAPI", "ChatInputButtonAPI"],

    chatBarButton: {
        icon: GhostTypingChatIcon,
        render: GhostTypingButton
    },

    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "ghosttyping",
            description: "Toggle Ghost Typing in this channel",
            execute: (_, ctx) => {
                toggle(ctx.channel.id);
                sendBotMessage(ctx.channel.id, { content: `⌨️ **Ghost Typing** is ${active.has(ctx.channel.id) ? "on — everyone sees you typing here" : "off"}.` });
            },
        },
    ],

    stop() {
        stopAll();
    }
});
