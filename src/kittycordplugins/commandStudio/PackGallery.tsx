/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { Flex } from "@components/Flex";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import type { PluginNative } from "@utils/types";
import { Alerts, Button, React, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { packShareUrl } from "../../branding";
import type { GalleryPack } from "./native";
import { addCommand, CustomCommand, getCommand, sanitizeCommands, settings } from "./settings";

const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const Native = VencordNative?.pluginHelpers?.CommandStudio as PluginNative<typeof import("./native")> | undefined;

const logger = new Logger("CommandStudio");
const TOKENS_KEY = "Kittycord_CommandPackTokens";
const NAME_RE = /^[\w\-'!&. ]{1,40}$/;

export type PackSort = "new" | "top" | "featured";

export const packsAvailable = () => Boolean(Native);

async function getTokens(): Promise<Record<string, string>> {
    return (await get<Record<string, string>>(TOKENS_KEY)) ?? {};
}

async function isMyPack(packId: string): Promise<boolean> {
    return Boolean((await getTokens())[packId]);
}

async function browsePacks(sort: PackSort): Promise<GalleryPack[]> {
    if (!Native) return [];
    const raw = await Native.listPacks(sort);
    return raw.map(p => ({
        id: String(p.id),
        name: String(p.name),
        authorName: String(p.authorName),
        likes: Number(p.likes) || 0,
        created: Number(p.created) || 0,
        featured: Boolean(p.featured),
        commandCount: Number(p.commandCount) || 0,
        triggers: Array.isArray(p.triggers) ? p.triggers.map(String) : []
    }));
}

async function fetchPack(id: string): Promise<{ pack: GalleryPack; commands: CustomCommand[]; } | null> {
    if (!Native) return null;
    const raw = await Native.getPack(id);
    if (!raw) return null;
    const commands = sanitizeCommands(raw.commands);
    if (!commands.length) return null;
    return {
        pack: {
            id: String(raw.id),
            name: String(raw.name),
            authorName: String(raw.authorName),
            likes: Number(raw.likes) || 0,
            created: Number(raw.created) || 0,
            featured: Boolean(raw.featured),
            commandCount: commands.length
        },
        commands
    };
}

async function likePack(packId: string): Promise<number | null> {
    if (!Native) return null;
    const me = UserStore.getCurrentUser();
    if (!me) return null;
    const result = await Native.likePack(me.id, packId);
    return result ? result.likes : null;
}

async function deletePack(packId: string): Promise<boolean> {
    if (!Native) return false;
    const tokens = await getTokens();
    const token = tokens[packId];
    if (!token) return false;
    const ok = await Native.deletePack(packId, token);
    if (ok) {
        delete tokens[packId];
        await set(TOKENS_KEY, tokens);
    }
    return ok;
}

async function publishPack(name: string, authorName: string, commands: CustomCommand[]): Promise<string> {
    if (!Native) throw new Error("The gallery needs the Kittycord desktop app.");
    const me = UserStore.getCurrentUser();
    if (!me) throw new Error("Could not read your account.");

    const result = await Native.publishPack(me.id, authorName, name, commands);
    if (!result.ok) throw new Error(result.error);

    const tokens = await getTokens();
    tokens[result.id] = result.ownerToken;
    await set(TOKENS_KEY, tokens);
    return result.id;
}

async function copyShareLink(id: string) {
    try {
        await navigator.clipboard.writeText(packShareUrl(id));
        showToast("Share link copied — anyone can preview this pack.", Toasts.Type.SUCCESS);
    } catch {
        showToast("Could not copy the link.", Toasts.Type.FAILURE);
    }
}

function ImportDialog({ rootProps, pack, commands }: { rootProps: any; pack: GalleryPack; commands: CustomCommand[]; }) {
    const prefix = settings.store.prefix.trim() || ".";
    const clashes = commands.filter(c => getCommand(c.trigger));

    function confirm() {
        commands.forEach(addCommand);
        showToast(`Added ${commands.length} command${commands.length === 1 ? "" : "s"} from "${pack.name}".`, Toasts.Type.SUCCESS);
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Add "{pack.name}"?</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" style={{ opacity: 0.85, margin: "12px 0" }}>
                    by {pack.authorName} — these commands get added to your own list. Nothing is sent anywhere; they only expand into text when you type them.
                </Text>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {commands.map(c => (
                        <span
                            key={c.trigger}
                            style={{
                                background: "var(--background-secondary)",
                                borderRadius: 6,
                                padding: "3px 8px",
                                fontSize: 12,
                                overflowWrap: "anywhere"
                            }}
                        >
                            {prefix}{c.trigger}
                        </span>
                    ))}
                </div>
                {clashes.length > 0 && (
                    <Text variant="text-sm/normal" style={{ color: "var(--text-danger)", marginBottom: 12 }}>
                        {clashes.length === 1
                            ? `You already have ${prefix}${clashes[0].trigger} — it will be replaced.`
                            : `${clashes.length} of your commands have the same trigger and will be replaced.`}
                    </Text>
                )}
                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} onClick={confirm}>Add commands</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export async function openPackImport(id: string) {
    const result = await fetchPack(id);
    if (!result) {
        showToast("Could not load that command pack.", Toasts.Type.FAILURE);
        return;
    }
    openModal(props => <ImportDialog rootProps={props} pack={result.pack} commands={result.commands} />);
}

function PackCard({ pack, onChanged }: { pack: GalleryPack; onChanged(): void; }) {
    const [likes, setLikes] = React.useState(pack.likes);
    const [mine, setMine] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const prefix = settings.store.prefix.trim() || ".";

    React.useEffect(() => { isMyPack(pack.id).then(setMine); }, [pack.id]);

    async function add() {
        setBusy(true);
        try {
            await openPackImport(pack.id);
        } finally {
            setBusy(false);
        }
    }

    async function like() {
        const result = await likePack(pack.id);
        if (result !== null) setLikes(result);
    }

    function remove() {
        Alerts.show({
            title: "Remove from gallery?",
            body: `This permanently removes "${pack.name}" from the community gallery.`,
            confirmText: "Remove",
            cancelText: "Cancel",
            confirmColor: Button.Colors.RED,
            onConfirm: async () => {
                if (await deletePack(pack.id)) {
                    showToast("Removed from the gallery.", Toasts.Type.SUCCESS);
                    onChanged();
                } else {
                    showToast("Could not remove that pack.", Toasts.Type.FAILURE);
                }
            }
        });
    }

    return (
        <div style={{ background: "var(--background-secondary)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
                {pack.featured && (
                    <Text variant="text-xs/semibold" style={{ color: "#ff8ac4", marginBottom: 2 }}>⭐ Staff pick</Text>
                )}
                <Text variant="text-md/semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pack.name}</Text>
                <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>by {pack.authorName} · {pack.commandCount} command{pack.commandCount === 1 ? "" : "s"}</Text>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, minHeight: 22 }}>
                {(pack.triggers ?? []).map(t => (
                    <span
                        key={t}
                        style={{
                            background: "var(--background-tertiary)",
                            borderRadius: 5,
                            padding: "2px 6px",
                            fontSize: 11,
                            opacity: 0.85,
                            overflowWrap: "anywhere"
                        }}
                    >
                        {prefix}{t}
                    </span>
                ))}
            </div>
            <Flex style={{ gap: 6, alignItems: "center" }}>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={add}>Add</Button>
                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={like}>♥ {likes}</Button>
                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => copyShareLink(pack.id)}>Share</Button>
                {mine && <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={remove}>Remove</Button>}
            </Flex>
        </div>
    );
}

function PackGalleryModal({ rootProps }: { rootProps: any; }) {
    const [sort, setSort] = React.useState<PackSort>("top");
    const [packs, setPacks] = React.useState<GalleryPack[] | null>(null);

    function load(which: PackSort) {
        setSort(which);
        setPacks(null);
        browsePacks(which).then(setPacks).catch(e => {
            logger.error("pack gallery load failed", e);
            setPacks([]);
        });
    }

    React.useEffect(() => { load("top"); }, []);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Command Packs ⌨️</Text>
                    <Button size={Button.Sizes.SMALL} look={sort === "featured" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("featured")} style={{ marginRight: 4 }}>Featured</Button>
                    <Button size={Button.Sizes.SMALL} look={sort === "top" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("top")} style={{ marginRight: 4 }}>Top</Button>
                    <Button size={Button.Sizes.SMALL} look={sort === "new" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("new")} style={{ marginRight: 8 }}>New</Button>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {packs === null && <Text variant="text-md/normal" style={{ padding: "24px 0", opacity: 0.7 }}>Loading packs…</Text>}
                {packs !== null && packs.length === 0 && (
                    <Text variant="text-md/normal" style={{ padding: "24px 0" }}>
                        {sort === "featured"
                            ? "No staff picks yet — check back soon, or browse Top and New."
                            : "No packs here yet — be the first to publish one from your own commands!"}
                    </Text>
                )}
                {packs !== null && packs.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "12px 0" }}>
                        {packs.map(p => <PackCard key={p.id} pack={p} onChanged={() => load(sort)} />)}
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

function PublishDialog({ rootProps, commands }: { rootProps: any; commands: CustomCommand[]; }) {
    const me = UserStore.getCurrentUser();
    const [name, setName] = React.useState("");
    const [authorName, setAuthorName] = React.useState((me?.globalName as string) || me?.username || "Someone");
    const [busy, setBusy] = React.useState(false);
    const [publishedId, setPublishedId] = React.useState<string | null>(null);

    const nameValid = NAME_RE.test(name.trim());
    const authorValid = authorName.trim().length > 0 && authorName.trim().length <= 40;

    async function publish() {
        if (!nameValid || !authorValid) return;
        setBusy(true);
        try {
            const id = await publishPack(name.trim(), authorName.trim(), commands);
            showToast(`"${name.trim()}" published! 🎉`, Toasts.Type.SUCCESS);
            setPublishedId(id);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not publish."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Publish a command pack</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {publishedId ? (
                    <>
                        <Text variant="text-sm/normal" style={{ opacity: 0.85, margin: "12px 0" }}>
                            Your pack is live. Copy its share link and paste it into any chat — one click adds it to a friend's commands.
                        </Text>
                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Done</Button>
                            <Button color={Button.Colors.BRAND} onClick={() => copyShareLink(publishedId)}>Copy share link</Button>
                        </Flex>
                    </>
                ) : (
                    <>
                        <Text variant="text-sm/normal" style={{ opacity: 0.85, margin: "12px 0" }}>
                            This shares {commands.length} command{commands.length === 1 ? "" : "s"} and the display name you choose — nothing else. No account, no messages. You can remove it anytime.
                        </Text>

                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Pack name</Text>
                        <TextInput value={name} onChange={setName} maxLength={40} placeholder="Team replies" />

                        <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>Show as</Text>
                        <TextInput value={authorName} onChange={setAuthorName} maxLength={40} placeholder="Your display name" />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                            <Button color={Button.Colors.BRAND} disabled={!nameValid || !authorValid || busy} onClick={publish}>Publish</Button>
                        </Flex>
                    </>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

export function openPackGallery() {
    openModal(props => <PackGalleryModal rootProps={props} />);
}

export function openPackPublish(commands: CustomCommand[]) {
    if (!commands.length) {
        showToast("Create a command first — then you can share it as a pack.", Toasts.Type.FAILURE);
        return;
    }
    openModal(props => <PublishDialog rootProps={props} commands={commands} />);
}
