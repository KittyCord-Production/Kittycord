/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to Kittycord and audited (clean: local DOM/CSS only, no network/token/eval).
// Original author kept as inline credit.

import "./styles.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { Menu, React, SelectedChannelStore, useEffect, UserStore, useState, useStateFromStores } from "@webpack/common";

const StreamStore = findByPropsLazy("getActiveStreamForUser", "getAllActiveStreams");
const StreamerModeStore = findByPropsLazy("hidePersonalInformation");

const settings = definePluginSettings({
    autoStreamProof: {
        type: OptionType.BOOLEAN,
        description: "Automatically enable StreamProof when you start streaming",
        default: false,
        onChange(value) {
            if (value && isStreaming()) {
                enableStreamProof();
            }
        }
    },
    exemptChannels: {
        type: OptionType.STRING,
        description: "Channel IDs (comma-separated) that stay visible while StreamProof is active. Right-click a chat to toggle it.",
        default: "",
        onChange: () => updateBlur()
    },
    autoProofChannels: {
        type: OptionType.STRING,
        description: "Channel IDs (comma-separated) that are always blurred when you open them, even if StreamProof is off. Right-click a chat to toggle it.",
        default: "",
        onChange: () => updateBlur()
    },
    toggleHotkey: {
        type: OptionType.STRING,
        description: "Hotkey to toggle StreamProof from anywhere, even in read-only channels with no chat box. Leave empty to disable.",
        default: "Alt+Shift+S"
    },
    headerButton: {
        type: OptionType.BOOLEAN,
        description: "Show a StreamProof button in the top toolbar, so you can always toggle it even where there's no chat box.",
        default: true,
        onChange: () => syncHeaderButton()
    }
});

const MAIN_SELECTORS = "[class*=\"messageContent_\"], [class*=\"markup_\"], [class*=\"imageWrapper_\"], [class*=\"embedWrapper_\"], [id^=\"message-accessories-\"] article, [class*=\"attachment_\"], [class*=\"video_\"], [class*=\"voiceMessage_\"], [class*=\"wrapperPaused_\"], [class*=\"wrapperPlaying_\"], [class*=\"audioAttachment_\"], [class*=\"fileUpload_\"], [class*=\"wrapperAudio_\"], [class*=\"mediaBarInteraction_\"], [class*=\"newMosaicStyle_\"], [class*=\"stickerAsset_\"]";
const DM_SELECTOR = "[class*=\"channel_\"][class*=\"interactive_\"]";

type ChannelMode = "default" | "exempt" | "auto";

let clickHandler: ((e: MouseEvent) => void) | null = null;
let streamProofActive = false;
let wasStreaming = false;

function getList(value: string): string[] {
    return value.split(",").map(id => id.trim()).filter(Boolean);
}

function isExempt(channelId?: string | null): boolean {
    return !!channelId && getList(settings.store.exemptChannels).includes(channelId);
}

function isAutoProof(channelId?: string | null): boolean {
    return !!channelId && getList(settings.store.autoProofChannels).includes(channelId);
}

function channelMode(channelId: string): ChannelMode {
    if (isAutoProof(channelId)) return "auto";
    if (isExempt(channelId)) return "exempt";
    return "default";
}

function setChannelMode(channelId: string, mode: ChannelMode) {
    const exempt = getList(settings.store.exemptChannels).filter(id => id !== channelId);
    const auto = getList(settings.store.autoProofChannels).filter(id => id !== channelId);
    if (mode === "exempt") exempt.push(channelId);
    if (mode === "auto") auto.push(channelId);
    settings.store.exemptChannels = exempt.join(",");
    settings.store.autoProofChannels = auto.join(",");
    updateBlur();
}

function shouldBlur(channelId?: string | null): boolean {
    if (isAutoProof(channelId)) return true;
    return streamProofActive && !isExempt(channelId);
}

function installClickHandler() {
    if (clickHandler) return;
    clickHandler = (e: MouseEvent) => {
        const target = e.target as HTMLElement | null;
        if (!target) return;
        const body = document.body.classList;
        const selector = body.contains("stream-proof-hide")
            ? (body.contains("stream-proof-enabled") ? `${MAIN_SELECTORS}, ${DM_SELECTOR}` : MAIN_SELECTORS)
            : (body.contains("stream-proof-enabled") ? DM_SELECTOR : "");
        if (!selector) return;
        const targetElement = target.closest(selector);
        if (targetElement && !targetElement.classList.contains("stream-proof-revealed")) {
            targetElement.classList.add("stream-proof-revealed");
            e.preventDefault();
            e.stopPropagation();
        }
    };
    document.addEventListener("click", clickHandler, true);
}

function removeClickHandler() {
    if (!clickHandler) return;
    document.removeEventListener("click", clickHandler, true);
    clickHandler = null;
}

function updateBlur() {
    const id = SelectedChannelStore.getChannelId();
    document.body.classList.toggle("stream-proof-enabled", streamProofActive);
    document.body.classList.toggle("stream-proof-hide", shouldBlur(id));
    if (streamProofActive || isAutoProof(id)) installClickHandler();
    else removeClickHandler();
}

function isStreaming(): boolean {
    try {
        if (StreamerModeStore?.hidePersonalInformation) return true;

        const currentUser = UserStore?.getCurrentUser?.();
        if (!currentUser) return false;

        if (StreamStore?.getActiveStreamForUser?.(currentUser.id)) return true;

        const allStreams = StreamStore?.getAllActiveStreams?.();
        if (allStreams?.some((s: any) => s.ownerId === currentUser.id)) return true;

        return false;
    } catch {
        return false;
    }
}

function handleStreamChange() {
    const streaming = isStreaming();
    if (streaming === wasStreaming) return;
    wasStreaming = streaming;
    if (streaming) {
        if (settings.store.autoStreamProof) enableStreamProof();
    } else {
        disableStreamProof();
    }
}

const buttonUpdaters = new Set<() => void>();
function notifyButtons() {
    buttonUpdaters.forEach(fn => fn());
}

function enableStreamProof() {
    if (streamProofActive) return;
    streamProofActive = true;
    updateBlur();
    notifyButtons();
}

function disableStreamProof() {
    if (!streamProofActive) return;
    streamProofActive = false;
    updateBlur();
    document.querySelectorAll(".stream-proof-revealed").forEach(el => el.classList.remove("stream-proof-revealed"));
    notifyButtons();
}

function toggleStreamProof() {
    if (streamProofActive) disableStreamProof();
    else enableStreamProof();
}

function matchesHotkey(e: KeyboardEvent): boolean {
    const combo = settings.store.toggleHotkey?.trim();
    if (!combo) return false;
    const parts = combo.split("+").map(p => p.trim().toLowerCase()).filter(Boolean);
    const key = parts[parts.length - 1];
    if (!key) return false;
    if (e.ctrlKey !== (parts.includes("ctrl") || parts.includes("control"))) return false;
    if (e.altKey !== parts.includes("alt")) return false;
    if (e.shiftKey !== parts.includes("shift")) return false;
    return e.code.toLowerCase() === `key${key}` || e.key.toLowerCase() === key;
}

function onKeyDown(e: KeyboardEvent) {
    if (!matchesHotkey(e)) return;
    e.preventDefault();
    toggleStreamProof();
}

function EyeIcon({ height = 20, width = 20 }: { height?: string | number; width?: string | number; }) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={width} height={height} fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M12 5C5.648 5 1 12 1 12s4.648 7 11 7 11-7 11-7-4.648-7-11-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
        </svg>
    );
}

function EyeSlashIcon({ height = 20, width = 20 }: { height?: string | number; width?: string | number; }) {
    return (
        <svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width={width} height={height} fill="none" viewBox="0 0 24 24">
            <path fill="currentColor" d="M2.22 2.22a.75.75 0 0 1 1.06 0l18.5 18.5a.75.75 0 1 1-1.06 1.06l-3.56-3.56A11.18 11.18 0 0 1 12 19C5.648 19 1 12 1 12s1.81-2.73 4.69-4.95L2.22 3.28a.75.75 0 0 1 0-1.06ZM7.1 8.52A8.87 8.87 0 0 0 3.07 12 9.57 9.57 0 0 0 12 17c1.47 0 2.85-.34 4.1-.93l-1.7-1.7A3 3 0 0 1 10.63 10.6L7.1 8.52ZM12 5c1.92 0 3.7.52 5.25 1.37l-1.5 1.5A8.87 8.87 0 0 0 20.93 12a9.57 9.57 0 0 1-3.37 3.44l1.5 1.5C21.42 15.2 23 12 23 12s-4.648-7-11-7Z" />
        </svg>
    );
}

const StreamProofButton: ChatBarButtonFactory = ({ isMainChat }) => {
    useStateFromStores([StreamerModeStore, StreamStore], () => isStreaming());
    const [, forceUpdate] = useState({});

    useEffect(() => {
        const fn = () => forceUpdate({});
        buttonUpdaters.add(fn);
        return () => { buttonUpdaters.delete(fn); };
    }, []);

    if (!isMainChat) return null;

    const active = streamProofActive;
    const tooltip = active ? "StreamProof: ON — click to disable" : "StreamProof: OFF — click to enable";

    return (
        <ChatBarButton tooltip={tooltip} onClick={toggleStreamProof}>
            <span style={{ color: active ? "var(--status-danger)" : "currentColor" }}>
                {active ? <EyeSlashIcon /> : <EyeIcon />}
            </span>
        </ChatBarButton>
    );
};

function StreamProofHeaderButtonInner() {
    const [, forceUpdate] = useState({});

    useEffect(() => {
        const fn = () => forceUpdate({});
        buttonUpdaters.add(fn);
        return () => { buttonUpdaters.delete(fn); };
    }, []);

    const active = streamProofActive;
    return (
        <HeaderBarButton
            tooltip={active ? "StreamProof: ON — click to disable" : "StreamProof: OFF — click to enable"}
            icon={active ? EyeSlashIcon : EyeIcon}
            onClick={toggleStreamProof}
            selected={active}
        />
    );
}

const StreamProofHeaderButton = ErrorBoundary.wrap(StreamProofHeaderButtonInner, { noop: true });

function syncHeaderButton() {
    removeHeaderBarButton("stream-proof");
    if (settings.store.headerButton) addHeaderBarButton("stream-proof", () => <StreamProofHeaderButton />, 8);
}

function StreamProofMenu(channelId: string) {
    const mode = channelMode(channelId);
    return (
        <Menu.MenuItem id="stream-proof" label="StreamProof" icon={EyeSlashIcon}>
            <Menu.MenuRadioItem
                id="stream-proof-default"
                group="stream-proof-mode"
                label="Only while StreamProof is on"
                checked={mode === "default"}
                action={() => setChannelMode(channelId, "default")}
            />
            <Menu.MenuRadioItem
                id="stream-proof-auto"
                group="stream-proof-mode"
                label="Always blur this chat"
                checked={mode === "auto"}
                action={() => setChannelMode(channelId, "auto")}
            />
            <Menu.MenuRadioItem
                id="stream-proof-never"
                group="stream-proof-mode"
                label="Never blur this chat"
                checked={mode === "exempt"}
                action={() => setChannelMode(channelId, "exempt")}
            />
        </Menu.MenuItem>
    );
}

const channelMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const id = props?.channel?.id;
    if (!id) return;
    children.push(StreamProofMenu(id));
};

const userMenuPatch: NavContextMenuPatchCallback = (children, props) => {
    const channel = props?.channel;
    if (!channel?.id || channel.type !== 1) return;
    children.push(StreamProofMenu(channel.id));
};

export default definePlugin({
    name: "StreamProof",
    description: "Blurs your messages, links, images, files and DMs (but not the screen share / voice grid) while streaming. Click an item to reveal it. Toggle via the chat bar button.",
    authors: [{ name: "Kittycord", id: 0n }, EquicordDevs.TheArmagan],
    dependencies: ["ChatInputButtonAPI", "HeaderBarAPI"],
    settings,

    chatBarButton: {
        icon: EyeSlashIcon,
        render: StreamProofButton,
    },

    contextMenus: {
        "channel-context": channelMenuPatch,
        "thread-context": channelMenuPatch,
        "gdm-context": channelMenuPatch,
        "user-context": userMenuPatch
    },

    flux: {
        STREAM_START() { handleStreamChange(); },
        STREAM_STOP() { handleStreamChange(); },
        STREAM_CREATE() { handleStreamChange(); },
        STREAM_DELETE() { handleStreamChange(); },
        STREAMER_MODE_UPDATE() { handleStreamChange(); },
        RTC_CONNECTION_STATE() { handleStreamChange(); },
        CHANNEL_SELECT() { updateBlur(); }
    },

    start() {
        wasStreaming = isStreaming();
        if (settings.store.autoStreamProof && wasStreaming) enableStreamProof();
        else updateBlur();
        window.addEventListener("keydown", onKeyDown);
        syncHeaderButton();
    },
    stop() {
        streamProofActive = false;
        document.body.classList.remove("stream-proof-enabled", "stream-proof-hide");
        removeClickHandler();
        document.querySelectorAll(".stream-proof-revealed").forEach(el => el.classList.remove("stream-proof-revealed"));
        window.removeEventListener("keydown", onKeyDown);
        removeHeaderBarButton("stream-proof");
        buttonUpdaters.clear();
        wasStreaming = false;
    }
});
