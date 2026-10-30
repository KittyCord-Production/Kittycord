/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { updateMessage } from "@api/MessageUpdater";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, GuildStore, MessageActions, React, SearchableSelect, TextInput } from "@webpack/common";
import type { SVGProps } from "react";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";

const KEY = "Kittycord_Bookmarks";

interface Bookmark {
    messageId: string;
    channelId: string;
    guildId: string | null;
    author: string;
    content: string;
    time: number;
}

let bookmarks: Bookmark[] = [];
let ids = new Set<string>();

async function load() {
    bookmarks = (await get<Bookmark[]>(KEY)) ?? [];
    ids = new Set(bookmarks.map(b => b.messageId));
}

async function save() {
    await set(KEY, bookmarks);
    ids = new Set(bookmarks.map(b => b.messageId));
}

async function toggle(msg: Message) {
    if (ids.has(msg.id)) {
        bookmarks = bookmarks.filter(b => b.messageId !== msg.id);
    } else {
        bookmarks = [{
            messageId: msg.id,
            channelId: msg.channel_id,
            guildId: ChannelStore.getChannel(msg.channel_id)?.guild_id ?? null,
            author: msg.author?.username ?? "Unknown",
            content: (msg.content || "").slice(0, 140),
            time: Date.now()
        }, ...bookmarks];
    }
    await save();
    updateMessage(msg.channel_id, msg.id);
}

function BookmarkIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
            <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
        </svg>
    );
}

function BookmarksModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [list, setList] = React.useState<Bookmark[]>(bookmarks);
    const [query, setQuery] = React.useState("");
    const [guild, setGuild] = React.useState("");

    function remove(id: string) {
        bookmarks = bookmarks.filter(b => b.messageId !== id);
        save();
        setList([...bookmarks]);
    }

    const serverOptions = [
        { label: "All servers", value: "" },
        ...[...new Set(list.map(b => b.guildId ?? "dm"))].map(key => ({
            value: key,
            label: key === "dm" ? "Direct Messages" : (GuildStore.getGuild(key)?.name ?? "Unknown server")
        }))
    ];

    const needle = query.toLowerCase();
    const shown = list.filter(b =>
        (!needle || b.author.toLowerCase().includes(needle) || b.content.toLowerCase().includes(needle))
        && (guild === "" || (b.guildId ?? "dm") === guild));

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Flex style={{ flexDirection: "column", gap: 8, width: "100%" }}>
                    <Flex style={{ alignItems: "center" }}>
                        <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Bookmarks ({shown.length}/{list.length})</Text>
                        <ModalCloseButton onClick={rootProps.onClose} />
                    </Flex>
                    <TextInput value={query} onChange={setQuery} placeholder="Search by author or text…" />
                    {serverOptions.length > 2 && (
                        <SearchableSelect options={serverOptions} value={guild} onChange={(v: string) => setGuild(v)} closeOnSelect />
                    )}
                </Flex>
            </ModalHeader>
            <ModalContent>
                {shown.length === 0
                    ? <Text style={{ padding: "16px 0" }}>{list.length === 0 ? "No bookmarks yet. Hover a message and click the bookmark button." : "Nothing matches your search."}</Text>
                    : shown.map(b => (
                        <Flex key={b.messageId} style={{ padding: "8px 0", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" weight="semibold">{b.author}</Text>
                                <Text size="sm" style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {b.content || "(no text)"}
                                </Text>
                            </div>
                            <Button size="small" onClick={() => {
                                MessageActions.jumpToMessage({ channelId: b.channelId, messageId: b.messageId, flash: true });
                                rootProps.onClose();
                            }}>Jump</Button>
                            <Button size="small" variant="dangerPrimary" onClick={() => remove(b.messageId)}>Remove</Button>
                        </Flex>
                    ))}
            </ModalContent>
        </ModalRoot>
    );
}

function openBookmarks() {
    openModal(props => <BookmarksModal rootProps={props} />);
}

export default definePlugin({
    name: "Bookmarks",
    description: "Privately bookmark messages (beyond Discord's 50-pin limit) with a hover button, then view and jump to them from the Kittycord menu in the header.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Chat"],
    dependencies: ["MessagePopoverAPI", "MessageUpdaterAPI"],

    messagePopoverButton: {
        icon: BookmarkIcon,
        render(msg: Message) {
            return {
                label: ids.has(msg.id) ? "Remove Bookmark" : "Bookmark",
                icon: BookmarkIcon,
                message: msg,
                channel: ChannelStore.getChannel(msg.channel_id),
                onClick: () => toggle(msg)
            };
        }
    },

    toolboxActions: {
        "Open Bookmarks"() {
            openBookmarks();
        }
    },

    async start() {
        await load();
    },

    stop() {
        bookmarks = [];
        ids.clear();
    }
});
