/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { getCurrentChannel } from "@utils/discord";
import { ModalSize } from "@utils/modal";
import type { RenderModalProps, User } from "@vencord/discord-types";
import { Button, DraftType, React, showToast, Text, TextInput, Toasts, UploadHandler } from "@webpack/common";

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
            showToast(`Sent to ${target.globalName || target.username}.`, Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send that."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    function postInChat() {
        const channel = getCurrentChannel();
        if (!channel) return showToast("Open a chat first to post it there.", Toasts.Type.FAILURE);
        UploadHandler.promptToUpload([buildFile()], channel, DraftType.ChannelMessage);
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>{title}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" style={{ margin: "12px 0", opacity: 0.8 }}>{blurb}</Text>

                <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Send to a friend</Text>
                <FriendPicker value={target} onChange={setTarget} />

                <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>Message</Text>
                <TextInput value={note} onChange={setNote} />

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={postInChat}>Post in current chat</Button>
                    <Button color={Button.Colors.BRAND} disabled={!target || busy} onClick={sendDm}>Send</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}
