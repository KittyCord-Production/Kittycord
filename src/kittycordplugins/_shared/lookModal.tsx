/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { getCurrentChannel, insertTextIntoChatInputBox } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalSize, openModal } from "@utils/modal";
import { saveFile } from "@utils/web";
import type { RenderModalProps, User } from "@vencord/discord-types";
import { DraftType, React, showToast, UploadHandler } from "@webpack/common";

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
                    showToast({ text: "Could not render your look card.", variant: "critical" });
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
        showToast({ text: "Saved your look card.", variant: "success" });
    }

    async function copy() {
        if (!blob) return;
        try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            showToast({ text: "Copied to clipboard.", variant: "success" });
        } catch (e) {
            logger.warn("Clipboard copy failed", e);
            showToast({ text: "Copying images isn't supported here — use Save instead.", variant: "critical" });
        }
    }

    function postInChat() {
        if (!blob) return;
        const channel = getCurrentChannel();
        if (!channel) return showToast({ text: "Open a chat first to post it there.", variant: "critical" });
        insertTextIntoChatInputBox(CAPTION);
        UploadHandler.promptToUpload([fileFromBlob(blob)], channel, DraftType.ChannelMessage);
        rootProps.onClose();
    }

    async function sendToFriend() {
        if (!blob || !target) return;
        setBusy(true);
        try {
            await sendFileToUser(target.id, fileFromBlob(blob), CAPTION);
            showToast({ text: `Sent to ${target.globalName || target.username}. 💌`, variant: "success" });
            rootProps.onClose();
        } catch (e) {
            showToast({ text: String((e as Error)?.message ?? "Could not send your look."), variant: "critical" });
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Show off your Kittycord look ✨</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {data === null ? (
                    <Text style={{ padding: "32px 0", opacity: 0.8 }}>
                        Set a name colour, a badge or an avatar decoration first (Settings → Kittycord), then come back to show it off. 🐱
                    </Text>
                ) : (
                    <>
                        <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                            {previewUrl
                                ? <img src={previewUrl} alt="Your Kittycord look card" style={{ width: "100%", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                                : <Text style={{ padding: "48px 0", opacity: 0.7 }}>Rendering your look…</Text>}
                        </div>

                        <Text size="sm" weight="semibold" style={{ marginBottom: 4 }}>Send to a friend</Text>
                        <FriendPicker value={target} onChange={setTarget} />

                        <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0", flexWrap: "wrap" }}>
                            <Button variant="secondary" disabled={!blob || busy} onClick={copy}>Copy</Button>
                            <Button variant="secondary" disabled={!blob || busy} onClick={save}>Save</Button>
                            <Button disabled={!blob || busy} onClick={postInChat}>Post in this chat</Button>
                            <Button disabled={!blob || !target || busy} onClick={sendToFriend}>Send to friend</Button>
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
