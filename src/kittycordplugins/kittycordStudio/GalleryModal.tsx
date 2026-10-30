/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { themeShareUrl } from "@branding";
import { Button, TextButton } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { copyWithToast } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalSize, openModal } from "@utils/modal";
import type { RenderModalProps } from "@vencord/discord-types";
import { Alerts, React, showToast, TextInput, UserStore } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";
import { browseGallery, deleteGalleryTheme, enableTheme, type GallerySort, type GalleryTheme, isMyTheme, likeGalleryTheme, publishTheme, saveTheme } from "./store";
import { derivePalette, NAME_RE, type StudioParams } from "./template";

const logger = new Logger("KittycordStudio");

function Swatches({ params }: { params: StudioParams; }) {
    const p = derivePalette(params);
    return (
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", height: 44 }}>
            {[p.bg[1], p.bg[3], p.accent, p.accentHi, p.text].map((c, i) => (
                <div key={i} style={{ flex: 1, background: c }} />
            ))}
        </div>
    );
}

function GalleryCard({ theme, onChanged }: { theme: GalleryTheme; onChanged(): void; }) {
    const [likes, setLikes] = React.useState(theme.likes);
    const [mine, setMine] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => { isMyTheme(theme.id).then(setMine); }, [theme.id]);

    async function apply() {
        setBusy(true);
        try {
            const fileName = await saveTheme(theme.params);
            enableTheme(fileName);
            showToast({ text: `"${theme.name}" applied. 🎨`, variant: "success" });
        } catch (e) {
            showToast({ text: String((e as Error)?.message ?? "Could not apply that theme."), variant: "critical" });
        } finally {
            setBusy(false);
        }
    }

    async function like() {
        const result = await likeGalleryTheme(theme.id);
        if (result !== null) setLikes(result);
    }

    function copyLink() {
        copyWithToast(themeShareUrl(theme.id), "Share link copied — anyone can preview this theme.");
    }

    function remove() {
        Alerts.show({
            title: "Remove from gallery?",
            body: `This permanently removes "${theme.name}" from the community gallery.`,
            confirmText: "Remove",
            cancelText: "Cancel",
            confirmColor: "danger",
            onConfirm: async () => {
                if (await deleteGalleryTheme(theme.id)) {
                    showToast({ text: "Removed from the gallery.", variant: "success" });
                    onChanged();
                } else {
                    showToast({ text: "Could not remove that theme.", variant: "critical" });
                }
            }
        });
    }

    return (
        <div style={{ background: "var(--background-secondary)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <Swatches params={theme.params} />
            <div>
                {theme.featured && (
                    <Text size="xs" weight="semibold" style={{ color: "#ff8ac4", marginBottom: 2 }}>⭐ Staff pick</Text>
                )}
                <Text weight="semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{theme.name}</Text>
                <Text size="xs" style={{ opacity: 0.6 }}>by {theme.authorName}</Text>
            </div>
            <Flex style={{ gap: 6, alignItems: "center" }}>
                <Button size="small" disabled={busy} onClick={apply}>Apply</Button>
                <TextButton onClick={like}>♥ {likes}</TextButton>
                <TextButton onClick={copyLink}>Share</TextButton>
                {mine && <TextButton variant="danger" onClick={remove}>Remove</TextButton>}
            </Flex>
        </div>
    );
}

function GalleryModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [sort, setSort] = React.useState<GallerySort>("top");
    const [themes, setThemes] = React.useState<GalleryTheme[] | null>(null);

    function load(which: GallerySort) {
        setSort(which);
        setThemes(null);
        browseGallery(which).then(setThemes).catch(e => {
            logger.error("gallery load failed", e);
            setThemes([]);
        });
    }

    React.useEffect(() => { load("top"); }, []);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Theme Gallery 🎨</Text>
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
                {themes === null && <Text style={{ padding: "24px 0", opacity: 0.7 }}>Loading the gallery…</Text>}
                {themes !== null && themes.length === 0 && (
                    <Text style={{ padding: "24px 0" }}>
                        {sort === "featured"
                            ? "No staff picks yet — check back soon, or browse Top and New."
                            : "No themes here yet — be the first to publish one from your Studio themes!"}
                    </Text>
                )}
                {themes !== null && themes.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, padding: "12px 0" }}>
                        {themes.map(t => <GalleryCard key={t.id} theme={t} onChanged={() => load(sort)} />)}
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

function PublishModal({ rootProps, params }: { rootProps: RenderModalProps; params: StudioParams; }) {
    const me = UserStore.getCurrentUser();
    const [authorName, setAuthorName] = React.useState((me?.globalName as string) || me?.username || "Someone");
    const [busy, setBusy] = React.useState(false);
    const [publishedId, setPublishedId] = React.useState<string | null>(null);

    const nameValid = authorName.trim().length > 0 && authorName.trim().length <= 40;

    async function publish() {
        if (!nameValid) return;
        setBusy(true);
        try {
            const id = await publishTheme(params, authorName.trim());
            showToast({ text: `"${params.name}" published to the gallery! 🎉`, variant: "success" });
            setPublishedId(id);
        } catch (e) {
            showToast({ text: String((e as Error)?.message ?? "Could not publish."), variant: "critical" });
        } finally {
            setBusy(false);
        }
    }

    async function copyShareLink() {
        if (!publishedId) return;
        try {
            await navigator.clipboard.writeText(themeShareUrl(publishedId));
            showToast({ text: "Share link copied. Paste it anywhere to show off your theme.", variant: "success" });
        } catch {
            showToast({ text: "Could not copy the link.", variant: "critical" });
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Publish "{params.name}"</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <Swatches params={params} />
                </div>
                {publishedId ? (
                    <>
                        <Text size="sm" style={{ opacity: 0.85, marginBottom: 12 }}>
                            "{params.name}" is live in the gallery. Copy its share link and paste it into any chat so friends can preview and apply it.
                        </Text>
                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <TextButton onClick={rootProps.onClose}>Done</TextButton>
                            <Button onClick={copyShareLink}>Copy share link</Button>
                        </Flex>
                    </>
                ) : (
                    <>
                        <Text size="sm" style={{ opacity: 0.85, marginBottom: 12 }}>
                            This shares the theme's colors and the display name you choose with the community gallery — nothing else. No account, no messages, no personal data. You can remove it anytime.
                        </Text>

                        <Text size="sm" weight="semibold" style={{ marginBottom: 4 }}>Show as</Text>
                        <TextInput value={authorName} onChange={setAuthorName} maxLength={40} placeholder="Your display name" />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <TextButton onClick={rootProps.onClose}>Cancel</TextButton>
                            <Button disabled={!nameValid || busy} onClick={publish}>Publish</Button>
                        </Flex>
                    </>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

export function openGallery() {
    openModal(props => <GalleryModal rootProps={props} />);
}

export function openPublish(params: StudioParams) {
    if (!NAME_RE.test(params.name.trim())) {
        showToast({ text: "Give your theme a valid name before publishing.", variant: "critical" });
        return;
    }
    openModal(props => <PublishModal rootProps={props} params={params} />);
}
