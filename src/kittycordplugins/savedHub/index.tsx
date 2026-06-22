/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { Flex } from "@components/Flex";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Button, ChannelStore, GuildStore, MessageActions, React, SearchableSelect, Text, TextInput } from "@webpack/common";
import type { ComponentType } from "react";

const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const COLLECTIONS_KEY = "Kittycord_Collections";
const BOOKMARKS_KEY = "Kittycord_Bookmarks";
const TAGS_KEY = "Kittycord_MessageTags";

type Source = "bookmark" | "tag";

interface UnifiedItem {
    messageId: string;
    channelId: string;
    author: string;
    content: string;
    time: number;
    guildId: string | null;
    sources: Source[];
    tags: string[];
}

interface BookmarkRow {
    messageId: string;
    channelId: string;
    guildId: string | null;
    author: string;
    content: string;
    time: number;
}

interface TagRow {
    channelId: string;
    author: string;
    content: string;
    tags: string[];
    time?: number;
}

let collections: Record<string, string[]> = {};

async function buildIndex(): Promise<UnifiedItem[]> {
    const bookmarks = (await get<BookmarkRow[]>(BOOKMARKS_KEY)) ?? [];
    const tags = (await get<Record<string, TagRow>>(TAGS_KEY)) ?? {};
    const map = new Map<string, UnifiedItem>();

    for (const b of bookmarks) {
        map.set(b.messageId, {
            messageId: b.messageId,
            channelId: b.channelId,
            author: b.author,
            content: b.content,
            time: b.time ?? 0,
            guildId: b.guildId ?? null,
            sources: ["bookmark"],
            tags: []
        });
    }

    for (const [id, e] of Object.entries(tags)) {
        const existing = map.get(id);
        if (existing) {
            if (!existing.sources.includes("tag")) existing.sources.push("tag");
            existing.tags = e.tags ?? [];
        } else {
            map.set(id, {
                messageId: id,
                channelId: e.channelId,
                author: e.author,
                content: e.content,
                time: e.time ?? 0,
                guildId: ChannelStore.getChannel(e.channelId)?.guild_id ?? null,
                sources: ["tag"],
                tags: e.tags ?? []
            });
        }
    }

    return [...map.values()].sort((a, b) => b.time - a.time);
}

const SOURCE_OPTIONS = [
    { label: "Everything", value: "all" },
    { label: "Bookmarks", value: "bookmark" },
    { label: "Tagged", value: "tag" }
];

function Chip({ children, color = "var(--brand-500)" }: { children: any; color?: string; }) {
    return <span style={{ background: color, color: "var(--white)", borderRadius: 8, padding: "1px 6px", fontSize: 11, marginLeft: 4 }}>{children}</span>;
}

function SavedModal({ rootProps, index }: { rootProps: any; index: UnifiedItem[]; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [query, setQuery] = React.useState("");
    const [source, setSource] = React.useState("all");
    const [guild, setGuild] = React.useState("");
    const [activeTags, setActiveTags] = React.useState<string[]>([]);
    const [folder, setFolder] = React.useState("");
    const [newFolder, setNewFolder] = React.useState("");

    const folderNames = Object.keys(collections).sort();
    const allTags = [...new Set(index.flatMap(i => i.tags))].sort();

    const serverOptions = [
        { label: "All servers", value: "" },
        ...[...new Set(index.map(i => i.guildId ?? "dm"))].map(key => ({
            value: key,
            label: key === "dm" ? "Direct Messages" : (GuildStore.getGuild(key)?.name ?? "Unknown server")
        }))
    ];

    function toggleTagFilter(tag: string) {
        setActiveTags(a => (a.includes(tag) ? a.filter(t => t !== tag) : [...a, tag]));
    }

    function addToFolder(name: string, messageId: string) {
        const arr = collections[name] ?? [];
        if (!arr.includes(messageId)) collections[name] = [...arr, messageId];
        set(COLLECTIONS_KEY, collections);
        forceUpdate();
    }

    function removeFromFolder(name: string, messageId: string) {
        collections[name] = (collections[name] ?? []).filter(x => x !== messageId);
        set(COLLECTIONS_KEY, collections);
        forceUpdate();
    }

    function createFolder() {
        const n = newFolder.trim();
        if (!n || collections[n]) return;
        collections[n] = [];
        set(COLLECTIONS_KEY, collections);
        setNewFolder("");
        forceUpdate();
    }

    function deleteFolder(name: string) {
        delete collections[name];
        set(COLLECTIONS_KEY, collections);
        if (folder === name) setFolder("");
        forceUpdate();
    }

    const needle = query.toLowerCase();
    const folderIds = folder ? new Set(collections[folder] ?? []) : null;
    const shown = index.filter(it =>
        (!needle || it.author.toLowerCase().includes(needle) || it.content.toLowerCase().includes(needle))
        && (source === "all" || it.sources.includes(source as Source))
        && (guild === "" || (it.guildId ?? "dm") === guild)
        && (activeTags.length === 0 || activeTags.some(t => it.tags.includes(t)))
        && (!folderIds || folderIds.has(it.messageId)));

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Flex style={{ flexDirection: "column", gap: 8, width: "100%" }}>
                    <Flex style={{ alignItems: "center" }}>
                        <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Saved ({shown.length}/{index.length})</Text>
                        <ModalCloseButton onClick={rootProps.onClose} />
                    </Flex>
                    <Flex style={{ gap: 8 }}>
                        <div style={{ flex: 2 }}>
                            <TextInput value={query} onChange={setQuery} placeholder="Search everything you've saved…" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect options={SOURCE_OPTIONS} value={source} onChange={(v: string) => setSource(v)} closeOnSelect />
                        </div>
                        {serverOptions.length > 2 && (
                            <div style={{ flex: 1 }}>
                                <SearchableSelect options={serverOptions} value={guild} onChange={(v: string) => setGuild(v)} closeOnSelect />
                            </div>
                        )}
                    </Flex>
                    <Flex style={{ gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                        <span onClick={() => setFolder("")} style={{ cursor: "pointer", background: "var(--background-modifier-accent)", borderRadius: 8, padding: "2px 8px", fontSize: 12, opacity: folder === "" ? 1 : 0.5 }}>All saved</span>
                        {folderNames.map(name => (
                            <span key={name} style={{ cursor: "pointer", background: "var(--brand-500)", color: "var(--white)", borderRadius: 8, padding: "2px 8px", fontSize: 12, opacity: folder === name ? 1 : 0.5 }}>
                                <span onClick={() => setFolder(name)}>{name} ({(collections[name] ?? []).length})</span>
                                <span onClick={() => deleteFolder(name)} style={{ marginLeft: 6, fontWeight: 700 }}>×</span>
                            </span>
                        ))}
                        <div style={{ width: 130 }}>
                            <TextInput value={newFolder} onChange={setNewFolder} placeholder="New folder…" />
                        </div>
                        <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} disabled={!newFolder.trim()} onClick={createFolder}>Add</Button>
                    </Flex>
                    {allTags.length > 0 && (
                        <Flex style={{ gap: 6, flexWrap: "wrap" }}>
                            {allTags.map(t => (
                                <span key={t} onClick={() => toggleTagFilter(t)} style={{ cursor: "pointer", background: "var(--brand-500)", color: "var(--white)", borderRadius: 8, padding: "2px 8px", fontSize: 12, opacity: activeTags.includes(t) ? 1 : 0.4 }}>{t}</span>
                            ))}
                        </Flex>
                    )}
                </Flex>
            </ModalHeader>
            <ModalContent>
                {shown.length === 0
                    ? <Text variant="text-md/normal" style={{ padding: "16px 0" }}>{index.length === 0 ? "Nothing saved yet. Bookmark a message or right-click → Tags, and it shows up here." : "Nothing matches your filters."}</Text>
                    : shown.map(it => (
                        <Flex key={it.messageId} style={{ padding: "8px 0", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="text-sm/semibold">
                                    {it.author}
                                    {it.sources.includes("bookmark") && <Chip color="var(--background-modifier-accent)">bookmark</Chip>}
                                    {it.tags.map(t => <Chip key={t}>{t}</Chip>)}
                                </Text>
                                <Text variant="text-sm/normal" style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.content || "(no text)"}</Text>
                            </div>
                            {folder
                                ? <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeFromFolder(folder, it.messageId)}>Remove</Button>
                                : folderNames.length > 0 && (
                                    <div style={{ width: 130 }}>
                                        <SearchableSelect options={folderNames.map(n => ({ label: "→ " + n, value: n }))} value={""} placeholder="Add to folder" onChange={(v: string) => addToFolder(v, it.messageId)} closeOnSelect />
                                    </div>
                                )}
                            <Button size={Button.Sizes.SMALL} onClick={() => {
                                MessageActions.jumpToMessage({ channelId: it.channelId, messageId: it.messageId, flash: true });
                                rootProps.onClose();
                            }}>Jump</Button>
                        </Flex>
                    ))}
            </ModalContent>
        </ModalRoot>
    );
}

async function openSaved() {
    collections = (await get<Record<string, string[]>>(COLLECTIONS_KEY)) ?? {};
    const index = await buildIndex();
    openModal(props => <SavedModal rootProps={props} index={index} />);
}

export default definePlugin({
    name: "SavedHub",
    description: "One place to search and organise everything you've saved — bookmarks and tagged messages together — and group them into your own folders. Open it from the Kittycord menu in the header.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Organisation"],

    toolboxActions: {
        "Open Saved"() {
            openSaved();
        }
    }
});
