/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { Alerts, Button, React, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { themeShareUrl } from "../../branding";
import { browseGallery, deleteGalleryTheme, enableTheme, type GallerySort, type GalleryTheme, isMyTheme, likeGalleryTheme, publishTheme, saveTheme } from "./store";
import { derivePalette, NAME_RE, type StudioParams } from "./template";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

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
            showToast(`"${theme.name}" applied. 🎨`, Toasts.Type.SUCCESS);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not apply that theme."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    async function like() {
        const result = await likeGalleryTheme(theme.id);
        if (result !== null) setLikes(result);
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(themeShareUrl(theme.id));
            showToast("Share link copied — anyone can preview this theme.", Toasts.Type.SUCCESS);
        } catch {
            showToast("Could not copy the link.", Toasts.Type.FAILURE);
        }
    }

    function remove() {
        Alerts.show({
            title: "Remove from gallery?",
            body: `This permanently removes "${theme.name}" from the community gallery.`,
            confirmText: "Remove",
            cancelText: "Cancel",
            confirmColor: Button.Colors.RED,
            onConfirm: async () => {
                if (await deleteGalleryTheme(theme.id)) {
                    showToast("Removed from the gallery.", Toasts.Type.SUCCESS);
                    onChanged();
                } else {
                    showToast("Could not remove that theme.", Toasts.Type.FAILURE);
                }
            }
        });
    }

    return (
        <div style={{ background: "var(--background-secondary)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <Swatches params={theme.params} />
            <div>
                {theme.featured && (
                    <Text variant="text-xs/semibold" style={{ color: "#ff8ac4", marginBottom: 2 }}>⭐ Staff pick</Text>
                )}
                <Text variant="text-md/semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{theme.name}</Text>
                <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>by {theme.authorName}</Text>
            </div>
            <Flex style={{ gap: 6, alignItems: "center" }}>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={apply}>Apply</Button>
                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={like}>♥ {likes}</Button>
                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={copyLink}>Share</Button>
                {mine && <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={remove}>Remove</Button>}
            </Flex>
        </div>
    );
}

function GalleryModal({ rootProps }: { rootProps: any; }) {
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
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Theme Gallery 🎨</Text>
                    <Button size={Button.Sizes.SMALL} look={sort === "featured" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("featured")} style={{ marginRight: 4 }}>Featured</Button>
                    <Button size={Button.Sizes.SMALL} look={sort === "top" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("top")} style={{ marginRight: 4 }}>Top</Button>
                    <Button size={Button.Sizes.SMALL} look={sort === "new" ? Button.Looks.FILLED : Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => load("new")} style={{ marginRight: 8 }}>New</Button>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {themes === null && <Text variant="text-md/normal" style={{ padding: "24px 0", opacity: 0.7 }}>Loading the gallery…</Text>}
                {themes !== null && themes.length === 0 && (
                    <Text variant="text-md/normal" style={{ padding: "24px 0" }}>
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

function PublishModal({ rootProps, params }: { rootProps: any; params: StudioParams; }) {
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
            showToast(`"${params.name}" published to the gallery! 🎉`, Toasts.Type.SUCCESS);
            setPublishedId(id);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not publish."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    async function copyShareLink() {
        if (!publishedId) return;
        try {
            await navigator.clipboard.writeText(themeShareUrl(publishedId));
            showToast("Share link copied. Paste it anywhere to show off your theme.", Toasts.Type.SUCCESS);
        } catch {
            showToast("Could not copy the link.", Toasts.Type.FAILURE);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Publish "{params.name}"</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <Swatches params={params} />
                </div>
                {publishedId ? (
                    <>
                        <Text variant="text-sm/normal" style={{ opacity: 0.85, marginBottom: 12 }}>
                            "{params.name}" is live in the gallery. Copy its share link and paste it into any chat so friends can preview and apply it.
                        </Text>
                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Done</Button>
                            <Button color={Button.Colors.BRAND} onClick={copyShareLink}>Copy share link</Button>
                        </Flex>
                    </>
                ) : (
                    <>
                        <Text variant="text-sm/normal" style={{ opacity: 0.85, marginBottom: 12 }}>
                            This shares the theme's colors and the display name you choose with the community gallery — nothing else. No account, no messages, no personal data. You can remove it anytime.
                        </Text>

                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Show as</Text>
                        <TextInput value={authorName} onChange={setAuthorName} maxLength={40} placeholder="Your display name" />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                            <Button color={Button.Colors.BRAND} disabled={!nameValid || busy} onClick={publish}>Publish</Button>
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
        showToast("Give your theme a valid name before publishing.", Toasts.Type.FAILURE);
        return;
    }
    openModal(props => <PublishModal rootProps={props} params={params} />);
}
