/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, TextButton } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { getCurrentChannel } from "@utils/discord";
import { ModalSize } from "@utils/modal";
import type { RenderModalProps, User } from "@vencord/discord-types";
import { DraftType, React, showToast, TextInput, UploadHandler } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";
import { sendFileToUser } from "./dm";
import { FriendPicker } from "./FriendPicker";

export function ShareFileModal({ rootProps, title, blurb, buildFile, defaultNote }: {
    rootProps: RenderModalProps;
    title: string;
    blurb: string;
    buildFile(): File;
    defaultNote: string;
}) {
    const [target, setTarget] = React.useState<User | null>(null);
    const [note, setNote] = React.useState(defaultNote);
    const [busy, setBusy] = React.useState(false);

    async function sendDm() {
        if (!target) return;
        setBusy(true);
        try {
            await sendFileToUser(target.id, buildFile(), note.trim());
            showToast({ text: `Sent to ${target.globalName || target.username}.`, variant: "success" });
            rootProps.onClose();
        } catch (e) {
            showToast({ text: String((e as Error)?.message ?? "Could not send that."), variant: "critical" });
        } finally {
            setBusy(false);
        }
    }

    function postInChat() {
        const channel = getCurrentChannel();
        if (!channel) return showToast({ text: "Open a chat first to post it there.", variant: "critical" });
        UploadHandler.promptToUpload([buildFile()], channel, DraftType.ChannelMessage);
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>{title}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text size="sm" style={{ margin: "12px 0", opacity: 0.8 }}>{blurb}</Text>

                <Text size="sm" weight="semibold" style={{ marginBottom: 4 }}>Send to a friend</Text>
                <FriendPicker value={target} onChange={setTarget} />

                <Text size="sm" weight="semibold" style={{ margin: "12px 0 4px" }}>Message</Text>
                <TextInput value={note} onChange={setNote} />

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <TextButton onClick={postInChat}>Post in current chat</TextButton>
                    <Button disabled={!target || busy} onClick={sendDm}>Send</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}
