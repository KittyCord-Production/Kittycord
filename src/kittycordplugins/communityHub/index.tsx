/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { WebsiteIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin, { type PluginNative } from "@utils/types";
import { Button, React, showToast, Text, Toasts } from "@webpack/common";
import type { ComponentType } from "react";

import { BRAND_WEBSITE } from "../../branding";
import { openGallery } from "../kittycordStudio/GalleryModal";
import { browseGallery, enableTheme, galleryAvailable, type GalleryTheme, saveTheme } from "../kittycordStudio/store";
import { derivePalette, type StudioParams } from "../kittycordStudio/template";
import type { NewsItem } from "./native";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const Native = VencordNative?.pluginHelpers?.CommunityHub as PluginNative<typeof import("./native")> | undefined;

const DISMISSED_KEY = "Kittycord_NewsDismissed";

const open = (url: string) => VencordNative.native.openExternal(url);

function Swatches({ params }: { params: StudioParams; }) {
    const p = derivePalette(params);
    return (
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 24, width: 72, flexShrink: 0 }}>
            {[p.bg[1], p.bg[3], p.accent, p.accentHi, p.text].map((c, i) => (
                <div key={i} style={{ flex: 1, background: c }} />
            ))}
        </div>
    );
}

function CommunityPanel() {
    const [news, setNews] = React.useState<NewsItem[] | null>(null);
    const [dismissed, setDismissed] = React.useState<string[]>([]);
    const [themes, setThemes] = React.useState<GalleryTheme[] | null>(null);
    const [anyFeatured, setAnyFeatured] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            setDismissed((await get<string[]>(DISMISSED_KEY)) ?? []);
            (Native ? Native.getNews() : Promise.resolve([])).then(setNews).catch(() => setNews([]));
            if (!galleryAvailable()) {
                setThemes([]);
                return;
            }
            try {
                const featured = await browseGallery("featured");
                if (featured.length > 0) {
                    setAnyFeatured(true);
                    setThemes(featured.slice(0, 4));
                } else {
                    setThemes((await browseGallery("top")).slice(0, 4));
                }
            } catch {
                setThemes([]);
            }
        })();
    }, []);

    async function dismiss(id: string) {
        const next = [...dismissed, id];
        setDismissed(next);
        await set(DISMISSED_KEY, next);
    }

    async function applyTheme(t: GalleryTheme) {
        setBusy(true);
        try {
            enableTheme(await saveTheme(t.params));
            showToast(`"${t.name}" applied. 🎨`, Toasts.Type.SUCCESS);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not apply that theme."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    const visibleNews = (news ?? []).filter(n => !dismissed.includes(n.id));
    const hasThemes = !!themes?.length;

    return (
        <ErrorBoundary noop>
            <Text variant="text-md/normal" style={{ marginBottom: 14, color: "var(--text-muted)" }}>
                What's happening across Kittycord — news, community themes and where to hang out.
            </Text>

            {visibleNews.length > 0 && (
                <>
                    <Text variant="text-sm/semibold" style={{ marginBottom: 6 }}>Latest</Text>
                    {visibleNews.map(n => (
                        <div key={n.id} style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                            <Flex style={{ alignItems: "flex-start", gap: 8 }}>
                                <div style={{ flexGrow: 1, minWidth: 0 }}>
                                    <Text variant="text-md/semibold">{n.title}</Text>
                                    <Text variant="text-sm/normal" style={{ opacity: 0.85, marginTop: 2 }}>{n.body}</Text>
                                    {n.url && (
                                        <a role="button" onClick={() => open(n.url!)} style={{ cursor: "pointer", color: "var(--text-link)", fontSize: 13, display: "inline-block", marginTop: 6 }}>
                                            Learn more
                                        </a>
                                    )}
                                </div>
                                <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => dismiss(n.id)}>Dismiss</Button>
                            </Flex>
                        </div>
                    ))}
                </>
            )}

            {hasThemes && (
                <>
                    <Flex style={{ alignItems: "center", marginTop: 6, marginBottom: 6 }}>
                        <Text variant="text-sm/semibold" style={{ flexGrow: 1 }}>{anyFeatured ? "Staff-pick themes" : "Popular themes"}</Text>
                        <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={openGallery}>Browse all</Button>
                    </Flex>
                    {themes!.map(t => (
                        <div key={t.id} style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 10, marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
                            <Swatches params={t.params} />
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                                <Text variant="text-sm/semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</Text>
                                <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>by {t.authorName}</Text>
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={() => applyTheme(t)}>Apply</Button>
                        </div>
                    ))}
                </>
            )}

            <div style={{ background: "var(--background-secondary)", borderRadius: 10, padding: 14, marginTop: 6 }}>
                <Text variant="text-md/semibold">Join the community</Text>
                <Text variant="text-sm/normal" style={{ opacity: 0.85, margin: "2px 0 10px" }}>
                    Chat, swap themes and share your setup with other Kittycord users.
                </Text>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => open(BRAND_WEBSITE)}>Visit kittycord.dev</Button>
            </div>
        </ErrorBoundary>
    );
}

function CommunityModal({ rootProps }: { rootProps: any; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Kittycord Community</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <CommunityPanel />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "CommunityHub",
    description: "A home for Kittycord news, staff-pick community themes and where to hang out — all in one place.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    toolboxActions: {
        "Open Community"() {
            openModal(props => <CommunityModal rootProps={props} />);
        }
    },

    start() {
        SettingsPlugin.customEntries.push({
            key: "kittycord_community",
            title: "Community",
            panelTitle: "Kittycord Community",
            Component: CommunityPanel,
            Icon: WebsiteIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_community");
    }
});
