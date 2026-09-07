/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { getCurrentChannel, insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalSize, openModal } from "@utils/modal";
import { saveFile } from "@utils/web";
import type { RenderModalProps, User } from "@vencord/discord-types";
import { Button, DraftType, React, showToast, Text, Toasts, UploadHandler } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";
import { sendFileToUser } from "./dm";
import { FriendPicker } from "./FriendPicker";
import { collectLook, LOOK_FILENAME, type LookData, renderLookCard } from "./lookCard";

const logger = new Logger("ShowOff");

const CAPTION = "my Kittycord look 🐱 https://kittycord.dev";

function fileFromBlob(blob: Blob) {
    return new File([blob], LOOK_FILENAME, { type: "image/png" });
}

function LookModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [data, setData] = React.useState<LookData | null | undefined>(undefined);
    const [blob, setBlob] = React.useState<Blob | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [target, setTarget] = React.useState<User | null>(null);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        (async () => {
            try {
                const look = await collectLook();
                if (cancelled) return;
                setData(look);
                if (!look) return;
                const result = await renderLookCard(look);
                if (cancelled) return;
                url = URL.createObjectURL(result);
                setBlob(result);
                setPreviewUrl(url);
            } catch (e) {
                logger.error("Failed to render look card", e);
                if (!cancelled) {
                    setData(null);
                    showToast("Could not render your look card.", Toasts.Type.FAILURE);
                }
            }
        })();
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, []);

    function save() {
        if (!blob) return;
        saveFile(fileFromBlob(blob));
        showToast("Saved your look card.", Toasts.Type.SUCCESS);
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

    function postInChat() {
        if (!blob) return;
        const channel = getCurrentChannel();
        if (!channel) return showToast("Open a chat first to post it there.", Toasts.Type.FAILURE);
        insertTextIntoChatInputBox(CAPTION);
        UploadHandler.promptToUpload([fileFromBlob(blob)], channel, DraftType.ChannelMessage);
        rootProps.onClose();
    }

    async function sendToFriend() {
        if (!blob || !target) return;
        setBusy(true);
        try {
            await sendFileToUser(target.id, fileFromBlob(blob), CAPTION);
            showToast(`Sent to ${target.globalName || target.username}. 💌`, Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send your look."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Show off your Kittycord look ✨</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {data === null ? (
                    <Text variant="text-md/normal" style={{ padding: "32px 0", opacity: 0.8 }}>
                        Set a name colour, a badge or an avatar decoration first (Settings → Kittycord), then come back to show it off. 🐱
                    </Text>
                ) : (
                    <>
                        <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                            {previewUrl
                                ? <img src={previewUrl} alt="Your Kittycord look card" style={{ width: "100%", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                                : <Text variant="text-md/normal" style={{ padding: "48px 0", opacity: 0.7 }}>Rendering your look…</Text>}
                        </div>

                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Send to a friend</Text>
                        <FriendPicker value={target} onChange={setTarget} />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0", flexWrap: "wrap" }}>
                            <Button color={Button.Colors.PRIMARY} disabled={!blob || busy} onClick={copy}>Copy</Button>
                            <Button color={Button.Colors.PRIMARY} disabled={!blob || busy} onClick={save}>Save</Button>
                            <Button color={Button.Colors.BRAND} disabled={!blob || busy} onClick={postInChat}>Post in this chat</Button>
                            <Button color={Button.Colors.BRAND} disabled={!blob || !target || busy} onClick={sendToFriend}>Send to friend</Button>
                        </Flex>
                    </>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

export function openLookModal() {
    openModal(props => <LookModal rootProps={props} />);
}
