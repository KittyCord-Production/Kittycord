/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { packShareUrl } from "@branding";
import { Button, TextButton } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { getKittyAuth } from "@kittycordplugins/_shared/kittyAuth";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalSize, openModal } from "@utils/modal";
import type { PluginNative } from "@utils/types";
import type { RenderModalProps } from "@vencord/discord-types";
import { Alerts, React, showToast, TextInput, UserStore } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";
import type { GalleryPack } from "./native";
import { addCommand, CustomCommand, getCommand, sanitizeCommands, settings } from "./settings";

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
    const auth = await getKittyAuth();
    if (!auth) return null;
    const result = await Native.likePack(me.id, packId, auth);
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

    const auth = await getKittyAuth();
    if (!auth) throw new Error("Log in with Discord to publish.");
    const result = await Native.publishPack(me.id, authorName, name, commands, false, auth);
    if (!result.ok) throw new Error(result.error);

    const tokens = await getTokens();
    tokens[result.id] = result.ownerToken;
    await set(TOKENS_KEY, tokens);
    return result.id;
}

export async function quickShare(name: string, commands: CustomCommand[]): Promise<string> {
    if (!Native) throw new Error("Links need the Kittycord desktop app.");
    const me = UserStore.getCurrentUser();
    if (!me) throw new Error("Could not read your account.");

    const authorName = (me.globalName as string) || me.username || "Someone";
    const auth = await getKittyAuth();
    if (!auth) throw new Error("Log in with Discord to publish.");
    const result = await Native.publishPack(me.id, authorName, name, commands, true, auth);
    if (!result.ok) throw new Error(result.error);

    return packShareUrl(result.id);
}

function copyShareLink(id: string) {
    copyWithToast(packShareUrl(id), "Share link copied — anyone can preview this pack.");
}

function ImportDialog({ rootProps, pack, commands }: { rootProps: RenderModalProps; pack: GalleryPack; commands: CustomCommand[]; }) {
    const prefix = settings.store.prefix.trim() || ".";
    const clashes = commands.filter(c => getCommand(c.trigger));

    function confirm() {
        commands.forEach(addCommand);
        showToast({ text: `Added ${commands.length} command${commands.length === 1 ? "" : "s"} from "${pack.name}".`, variant: "success" });
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Add "{pack.name}"?</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text size="sm" style={{ opacity: 0.85, margin: "12px 0" }}>
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
                            {prefix}{c.trigger}{c.description ? ` — ${c.description}` : ""}
                        </span>
                    ))}
                </div>
                {clashes.length > 0 && (
                    <Text size="sm" style={{ color: "var(--text-danger)", marginBottom: 12 }}>
                        {clashes.length === 1
                            ? `You already have ${prefix}${clashes[0].trigger} — it will be replaced.`
                            : `${clashes.length} of your commands have the same trigger and will be replaced.`}
                    </Text>
                )}
                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <TextButton onClick={rootProps.onClose}>Cancel</TextButton>
                    <Button onClick={confirm}>Add commands</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export function openCommandsImport(commands: CustomCommand[], name: string, authorName: string) {
    const pack: GalleryPack = { id: "", name, authorName, likes: 0, created: 0, featured: false, commandCount: commands.length };
    openModal(props => <ImportDialog rootProps={props} pack={pack} commands={commands} />);
}

export async function openPackImport(id: string) {
    const result = await fetchPack(id);
    if (!result) {
        showToast({ text: "Could not load that command pack.", variant: "critical" });
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
            confirmColor: "danger",
            onConfirm: async () => {
                if (await deletePack(pack.id)) {
                    showToast({ text: "Removed from the gallery.", variant: "success" });
                    onChanged();
                } else {
                    showToast({ text: "Could not remove that pack.", variant: "critical" });
                }
            }
        });
    }

    return (
        <div style={{ background: "var(--background-secondary)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
                {pack.featured && (
                    <Text size="xs" weight="semibold" style={{ color: "#ff8ac4", marginBottom: 2 }}>⭐ Staff pick</Text>
                )}
                <Text weight="semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pack.name}</Text>
                <Text size="xs" style={{ opacity: 0.6 }}>by {pack.authorName} · {pack.commandCount} command{pack.commandCount === 1 ? "" : "s"}</Text>
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
                <Button size="small" disabled={busy} onClick={add}>Add</Button>
                <TextButton onClick={like}>♥ {likes}</TextButton>
                <TextButton onClick={() => copyShareLink(pack.id)}>Share</TextButton>
                {mine && <TextButton variant="danger" onClick={remove}>Remove</TextButton>}
            </Flex>
        </div>
    );
}

function PackGalleryModal({ rootProps }: { rootProps: RenderModalProps; }) {
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
                    <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Command Packs ⌨️</Text>
                    {sort === "featured"
                        ? <Button size="small" variant="secondary" onClick={() => load("featured")} style={{ marginRight: 4 }}>Featured</Button>
                        : <TextButton onClick={() => load("featured")} style={{ marginRight: 4 }}>Featured</TextButton>}
                    {sort === "top"
                        ? <Button size="small" variant="secondary" onClick={() => load("top")} style={{ marginRight: 4 }}>Top</Button>
                        : <TextButton onClick={() => load("top")} style={{ marginRight: 4 }}>Top</TextButton>}
                    {sort === "new"
                        ? <Button size="small" variant="secondary" onClick={() => load("new")} style={{ marginRight: 8 }}>New</Button>
                        : <TextButton onClick={() => load("new")} style={{ marginRight: 8 }}>New</TextButton>}
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {packs === null && <Text style={{ padding: "24px 0", opacity: 0.7 }}>Loading packs…</Text>}
                {packs !== null && packs.length === 0 && (
                    <Text style={{ padding: "24px 0" }}>
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

function PublishDialog({ rootProps, commands }: { rootProps: RenderModalProps; commands: CustomCommand[]; }) {
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
            showToast({ text: `"${name.trim()}" published! 🎉`, variant: "success" });
            setPublishedId(id);
        } catch (e) {
            showToast({ text: String((e as Error)?.message ?? "Could not publish."), variant: "critical" });
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Publish a command pack</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {publishedId ? (
                    <>
                        <Text size="sm" style={{ opacity: 0.85, margin: "12px 0" }}>
                            Your pack is live. Copy its share link and paste it into any chat — one click adds it to a friend's commands.
                        </Text>
                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <TextButton onClick={rootProps.onClose}>Done</TextButton>
                            <Button onClick={() => copyShareLink(publishedId)}>Copy share link</Button>
                        </Flex>
                    </>
                ) : (
                    <>
                        <Text size="sm" style={{ opacity: 0.85, margin: "12px 0" }}>
                            This shares {commands.length} command{commands.length === 1 ? "" : "s"} and the display name you choose — nothing else. No account, no messages. You can remove it anytime.
                        </Text>

                        <Text size="sm" weight="semibold" style={{ marginBottom: 4 }}>Pack name</Text>
                        <TextInput value={name} onChange={setName} maxLength={40} placeholder="Team replies" />

                        <Text size="sm" weight="semibold" style={{ margin: "12px 0 4px" }}>Show as</Text>
                        <TextInput value={authorName} onChange={setAuthorName} maxLength={40} placeholder="Your display name" />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <TextButton onClick={rootProps.onClose}>Cancel</TextButton>
                            <Button disabled={!nameValid || !authorValid || busy} onClick={publish}>Publish</Button>
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
        showToast({ text: "Create a command first — then you can share it as a pack.", variant: "critical" });
        return;
    }
    openModal(props => <PublishDialog rootProps={props} commands={commands} />);
}
