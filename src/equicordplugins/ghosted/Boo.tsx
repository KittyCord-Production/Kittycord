/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { del, get, set } from "@api/DataStore";
import { Channel, Message } from "@vencord/discord-types";
import { findCssClassesLazy } from "@webpack";
import { MessageStore, SelectedChannelStore, useEffect, UserStore, useState, useStateFromStores } from "@webpack/common";

import { cl, settings } from ".";
import { IconGhost } from "./IconGhost";

function isChannelExempted(channel: Channel): boolean {
    const exemptList = settings.store.exemptedChannels
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);
    const isGroupDmsExempted = settings.store.ignoreGroupDms && channel.isGroupDM();

    return exemptList.includes(channel.id) || isGroupDmsExempted;
}

const countedChannels = new Set<string>();
// track channels that were manually cleared and when
const clearedChannels = new Map<string, number>();
// listeners for when a channel is cleared or un-cleared (thororen is this allowed lolz)
const clearedChannelListeners = new Set<(channelId: string) => void>();

let _booCount = 0;
const listeners = new Set<(n: number) => void>();

export function getBooCount() {
    return _booCount;
}

export function setBooCount(n: number) {
    _booCount = n;
    for (const l of listeners) l(_booCount);
}

export function onBooCountChange(cb: (n: number) => void) {
    listeners.add(cb);
    return () => {
        listeners.delete(cb);
    };
}

export function onClearedChannelChange(cb: (channelId: string) => void) {
    clearedChannelListeners.add(cb);
    return () => {
        clearedChannelListeners.delete(cb);
    };
}

const CLEARED_CHANNELS_KEY = "Ghosted_clearedChannels";

export function saveClearedChannels() {
    set(CLEARED_CHANNELS_KEY, Array.from(clearedChannels.entries())).catch(() => { });
}

function maybePersistCleared() {
    if (settings.store.persistCleared) saveClearedChannels();
}

export function clearStoredClearedChannels() {
    del(CLEARED_CHANNELS_KEY).catch(() => { });
}

const DISCORD_EPOCH = 1420070400000;

function snowflakeToTimestamp(id: string): number {
    return Number(BigInt(id) >> 22n) + DISCORD_EPOCH;
}

export async function loadClearedChannels() {
    if (!settings.store.persistCleared) return;
    try {
        const stored = await get<[string, string | number][]>(CLEARED_CHANNELS_KEY);
        if (!Array.isArray(stored)) return;
        for (const [channelId, value] of stored) {
            clearedChannels.set(channelId, typeof value === "number" ? value : snowflakeToTimestamp(value));
            if (countedChannels.has(channelId)) {
                countedChannels.delete(channelId);
                setBooCount(getBooCount() - 1);
            }
            for (const listener of clearedChannelListeners) listener(channelId);
        }
    } catch { }
}

export function getGhostedChannels(): string[] {
    return Array.from(countedChannels);
}

export function clearChannelFromGhost(channelId: string): void {
    if (countedChannels.delete(channelId)) {
        setBooCount(getBooCount() - 1);
    }

    // so we can detect new messages from the other person
    const lastMessage = MessageStore.getMessages(channelId)?.last();
    const lastMessageTimestampMs = lastMessage ? new Date(lastMessage.timestamp).getTime() : 0;
    clearedChannels.set(channelId, Math.max(Date.now(), lastMessageTimestampMs));
    maybePersistCleared();

    // notify all listeners that this channel was cleared
    for (const listener of clearedChannelListeners) {
        listener(channelId);
    }
}

export function isChannelCleared(channelId: string): boolean {
    return clearedChannels.has(channelId);
}

const ChannelWrapperStyles = findCssClassesLazy("muted", "wrapper");

export function Boo({ channel }: { channel: Channel; }) {
    const { id } = channel;

    const currentUserId = useStateFromStores([UserStore], () => UserStore.getCurrentUser()?.id);
    const selectedChannelId = useStateFromStores([SelectedChannelStore], () => SelectedChannelStore.getChannelId());
    const lastMessage: Message = useStateFromStores([MessageStore], () =>
        MessageStore.getMessages(id)?.last()
    );
    const isViewing = selectedChannelId === id;

    const [state, setState] = useState({
        isCurrentUser: null as boolean | null,
        containsQuestionMark: false,
        isDataProcessed: false,
    });
    const [isCleared, setIsCleared] = useState(false);

    const lastMessageTimestampMs = lastMessage ? new Date(lastMessage.timestamp).getTime() : 0;
    const isInactive = !!lastMessage && settings.store.maxInactiveTimeMs > 0 && Number.isFinite(lastMessageTimestampMs) && Date.now() - lastMessageTimestampMs > settings.store.maxInactiveTimeMs;

    useEffect(() => {
        if (!lastMessage || !currentUserId) return;

        const lastIsCurrentUser = lastMessage.author.id === currentUserId;
        const containsQuestionMark = !lastIsCurrentUser && lastMessage.content.includes("?");

        setState({
            isCurrentUser: lastIsCurrentUser,
            containsQuestionMark,
            isDataProcessed: true,
        });
    }, [lastMessage, currentUserId]);

    // track if this channel was manually cleared
    useEffect(() => {
        setIsCleared(clearedChannels.has(id));

        // subscribe to cleared channel changes for instant visual updates
        const unsubscribe = onClearedChannelChange(clearedChannelId => {
            if (clearedChannelId === id) {
                // check current state: if it's still in clearedChannels, it was cleared; otherwise un-cleared
                setIsCleared(clearedChannels.has(id));
            }
        });

        return unsubscribe;
    }, [id, lastMessage?.id]);

    useEffect(() => {
        if (!state.isDataProcessed) return;

        const isExempted = isChannelExempted(channel);
        let wasManuallyCleared = clearedChannels.has(id);

        // if manually cleared, check if there's a NEW message from the other person
        if (wasManuallyCleared && !state.isCurrentUser) {
            const clearedAt = clearedChannels.get(id)!;

            // only a message newer than the clear un-clears; just opening the chat never does
            if (lastMessageTimestampMs <= clearedAt) {
                return;
            }

            clearedChannels.delete(id);
            maybePersistCleared();
            wasManuallyCleared = false;
            // notify listeners that this channel is no longer cleared (new message)
            for (const listener of clearedChannelListeners) {
                listener(id);
            }
        }

        // if the current user responded, clear all tracking
        if (state.isCurrentUser) {
            if (countedChannels.has(id)) {
                countedChannels.delete(id);
                setBooCount(getBooCount() - 1);
            }
            if (clearedChannels.has(id)) {
                clearedChannels.delete(id);
                maybePersistCleared();
            }
            return;
        }

        // if exempted, bot (if setting enabled) or currently open, remove from ghost tracking
        if (isExempted || (settings.store.ignoreBots && lastMessage.author.bot) || isInactive || isViewing) {
            if (countedChannels.has(id)) {
                countedChannels.delete(id);
                setBooCount(getBooCount() - 1);
            }
            return;
        }

        // if manually cleared, don't add back to ghost count
        if (wasManuallyCleared) {
            return;
        }

        // normal ghosting logic: last message is from other person
        if (!state.isCurrentUser) {
            if (!countedChannels.has(id)) {
                countedChannels.add(id);
                setBooCount(getBooCount() + 1);
            }
        }
    }, [state.isCurrentUser, state.isDataProcessed, id, lastMessage?.id, isInactive, isViewing]);

    if (!state.isDataProcessed || !currentUserId || !lastMessage || state.isCurrentUser || isChannelExempted(channel) || isCleared || (settings.store.ignoreBots && lastMessage.author.bot) || isInactive || isViewing)
        return null;

    if (!settings.store.showDmIcons) return null;

    return (
        <div className={cl("icon", ChannelWrapperStyles.wrapper)}>
            <IconGhost fill={state.containsQuestionMark ? "#ff8000" : "currentColor"} />
        </div>
    );
}
