/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { getCurrentChannel, insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { saveFile } from "@utils/web";
import { Alerts, Button, DraftType, React, showToast, Text, Toasts, UploadHandler } from "@webpack/common";
import type { ComponentType } from "react";

import { renderCard, renderShareCard, SKINS, type WrappedVariant } from "./card";
import { settings } from "./settings";
import { buildSnapshot, resetData } from "./storage";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const logger = new Logger("KittycordWrapped");

function fileFromBlob(blob: Blob, variant: WrappedVariant) {
    return new File([blob], variant === "summer" ? "kittycord-summer.png" : "kittycord-wrapped.png", { type: "image/png" });
}

const CAPTIONS: Record<WrappedVariant, string> = {
    year: "my year on Discord, by Kittycord 🐱 https://kittycord.dev",
    summer: "my Kittycord summer so far 🐱☀️ https://kittycord.dev"
};

const TITLES: Record<WrappedVariant, string> = {
    year: "Kittycord Wrapped 🎁",
    summer: "Kittycord Summer ☀️"
};

function WrappedModal({ rootProps, variant }: { rootProps: any; variant: WrappedVariant; }) {
    const skin = SKINS[variant];
    const [showNames, setShowNames] = React.useState(settings.store.showServerNames);
    const [landscape, setLandscape] = React.useState(false);
    const [blob, setBlob] = React.useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        (async () => {
            try {
                const snap = buildSnapshot(showNames);
                const result = await (landscape ? renderShareCard(snap, skin) : renderCard(snap, skin));
                if (cancelled) return;
                url = URL.createObjectURL(result);
                setBlob(result);
                setPreviewUrl(url);
            } catch (e) {
                logger.error("Failed to render card", e);
                if (!cancelled) showToast("Could not render your Wrapped card.", Toasts.Type.FAILURE);
            }
        })();
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, [showNames, landscape, skin]);

    function onToggleNames(value: boolean) {
        settings.store.showServerNames = value;
        setShowNames(value);
    }

    function save() {
        if (!blob) return;
        saveFile(fileFromBlob(blob, variant));
        showToast("Saved your card.", Toasts.Type.SUCCESS);
    }

    function send() {
        if (!blob) return;
        const channel = getCurrentChannel();
        if (!channel) return showToast("Open a chat first to send it there.", Toasts.Type.FAILURE);
        insertTextIntoChatInputBox(CAPTIONS[variant]);
        UploadHandler.promptToUpload([fileFromBlob(blob, variant)], channel, DraftType.ChannelMessage);
        rootProps.onClose();
    }

    async function copy() {
        if (!blob) return;
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showToast("Copied to clipboard.", Toasts.Type.SUCCESS);
        } catch (e) {
            logger.warn("Clipboard copy failed", e);
            showToast("Copying images isn't supported here — use Save instead.", Toasts.Type.FAILURE);
        }
    }

    function reset() {
        Alerts.show({
            title: "Reset your Wrapped stats?",
            body: "This permanently deletes everything Kittycord Wrapped has measured on this device. Live stats like your servers and account age stay. This can't be undone.",
            confirmText: "Delete my stats",
            cancelText: "Cancel",
            confirmColor: Button.Colors.RED,
            onConfirm: async () => {
                setBusy(true);
                try {
                    await resetData();
                    const snap = buildSnapshot(showNames);
                    const result = await (landscape ? renderShareCard(snap, skin) : renderCard(snap, skin));
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setBlob(result);
                    setPreviewUrl(URL.createObjectURL(result));
                    showToast("Your Wrapped stats were reset.", Toasts.Type.SUCCESS);
                } catch (e) {
                    logger.error("Reset failed", e);
                } finally {
                    setBusy(false);
                }
            }
        });
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>{TITLES[variant]}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                    {previewUrl
                        ? <img src={previewUrl} alt="Your Kittycord Wrapped card" style={{ width: landscape ? "100%" : "60%", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                        : <Text variant="text-md/normal" style={{ padding: "48px 0", opacity: 0.7 }}>Rendering your card…</Text>}
                </div>

                <FormSwitch
                    title="Show server names"
                    description="Off by default — your servers appear as “Server 1/2/3”. Turn on only if you're happy to share their names."
                    value={showNames}
                    onChange={onToggleNames}
                />

                <FormSwitch
                    title="Wide format"
                    description="A compact landscape card that previews nicely when posted in chat."
                    value={landscape}
                    onChange={setLandscape}
                />

                <Text variant="text-xs/normal" style={{ opacity: 0.6, margin: "8px 0 16px" }}>
                    Everything here is measured and rendered 100% on your device. Nothing is uploaded unless you choose to send it.
                </Text>

                <Flex style={{ gap: 8, justifyContent: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
                    <Button color={Button.Colors.RED} look={Button.Looks.LINK} disabled={busy} onClick={reset}>Reset stats</Button>
                    <Button color={Button.Colors.PRIMARY} disabled={!blob || busy} onClick={copy}>Copy</Button>
                    <Button color={Button.Colors.BRAND} disabled={!blob || busy} onClick={save}>Save</Button>
                    <Button color={Button.Colors.BRAND} disabled={!blob || busy} onClick={send}>Send in chat</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export function openWrappedModal(variant: WrappedVariant = "year") {
    openModal(props => <WrappedModal rootProps={props} variant={variant} />);
}
