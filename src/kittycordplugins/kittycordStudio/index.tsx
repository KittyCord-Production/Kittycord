/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/index";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { Alerts, Button, showToast, Text, Toasts, UserStore } from "@webpack/common";

import { openGallery } from "./GalleryModal";
import { fetchTheme, findThemeAttachment } from "./share";
import { enableTheme, loadThemes, saveTheme } from "./store";
import { openStudio, PreviewPane } from "./StudioModal";
import type { StudioParams } from "./template";

function importBody(params: StudioParams, sender: string) {
    return (
        <div style={{ textAlign: "left" }}>
            <div style={{ margin: "4px 0 12px" }}>
                <PreviewPane params={params} />
            </div>
            <Text variant="text-md/normal">
                "{params.name}" by {sender} — made with Kittycord Studio. Adding it saves the theme to your themes folder.
            </Text>
        </div>
    );
}

function ThemeImportCardInner({ message }: { message: Message; }) {
    const attachment = findThemeAttachment(message.attachments);
    const own = message.author?.id === UserStore.getCurrentUser()?.id;
    if (!attachment) return null;

    async function startImport() {
        try {
            const { params, sender } = await fetchTheme(attachment!);
            Alerts.show({
                title: own ? "Add your shared theme?" : `Add ${sender}'s theme?`,
                body: importBody(params, sender),
                confirmText: "Add & apply",
                secondaryConfirmText: "Just add",
                cancelText: "Cancel",
                onConfirm: async () => {
                    const fileName = await saveTheme(params);
                    enableTheme(fileName);
                    showToast(`"${params.name}" applied. 🎨`, Toasts.Type.SUCCESS);
                },
                onConfirmSecondary: async () => {
                    await saveTheme(params);
                    showToast(`"${params.name}" added to your Studio themes.`, Toasts.Type.SUCCESS);
                }
            });
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not read that theme."), Toasts.Type.FAILURE);
        }
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, margin: "4px 0", borderRadius: 8, background: "var(--background-secondary)" }}>
            <Text variant="text-md/semibold" style={{ flex: 1 }}>
                🎨 {own ? "Your shared Studio theme" : `${message.author?.username ?? "Someone"} shared a theme made with Kittycord Studio`}
            </Text>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={startImport}>Preview &amp; add</Button>
        </div>
    );
}

const ThemeImportCard = ErrorBoundary.wrap(ThemeImportCardInner, { noop: true });

export default definePlugin({
    name: "KittycordStudio",
    description: "Build your own Discord theme from a few colors — pick a palette, roundness and sparkles, and Kittycord generates and applies the theme for you. No CSS needed. Share your themes with friends for one-tap import.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance"],
    enabledByDefault: true,
    dependencies: ["MessageAccessoriesAPI"],

    toolboxActions: {
        "Open Studio"() {
            openStudio();
        },
        "Open Gallery"() {
            openGallery();
        }
    },

    renderMessageAccessory({ message }) {
        if (!findThemeAttachment(message.attachments)) return null;
        return <ThemeImportCard message={message} />;
    },

    async start() {
        await loadThemes();
    }
});
