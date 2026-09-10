/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { fetchUserProfile } from "@utils/discord";
import type { RenderModalProps, User } from "@vencord/discord-types";
import { Avatar, IconUtils, Modal, showToast, TextInput, Toasts, UserStore,useState } from "@webpack/common";

import { FriendPicker } from "../_shared/FriendPicker";
import { getDisguise, removeDisguise, setDisguise } from "./settings";

const cl = classNameFactory("vc-disguise-");
const ID_RE = /^\d{17,20}$/;

async function resolveUser(id: string) {
    const cached = UserStore.getUser(id);
    if (cached) return cached;

    await fetchUserProfile(id, undefined, false);
    return UserStore.getUser(id);
}

export function DisguiseModal({ modalProps, userId }: { modalProps: RenderModalProps; userId: string; }) {
    const existing = getDisguise(userId);
    const [templateId, setTemplateId] = useState(existing?.templateId ?? "");
    const [busy, setBusy] = useState(false);

    const preview = ID_RE.test(templateId) ? UserStore.getUser(templateId) : null;

    async function save() {
        if (!ID_RE.test(templateId)) {
            showToast("That is not a valid account ID.", Toasts.Type.FAILURE);
            return;
        }
        if (templateId === userId) {
            showToast("Pick a different account than the one you are hiding.", Toasts.Type.FAILURE);
            return;
        }

        setBusy(true);
        const template = await resolveUser(templateId);
        if (!template) {
            setBusy(false);
            showToast("No account with that ID exists.", Toasts.Type.FAILURE);
            return;
        }

        setDisguise(userId, {
            templateId,
            username: template.username,
            globalName: template.globalName,
            discriminator: template.discriminator,
            avatar: template.avatar,
            banner: template.banner
        });
        await fetchUserProfile(userId, undefined, false);
        modalProps.onClose();
    }

    async function drop() {
        setBusy(true);
        removeDisguise(userId);
        await fetchUserProfile(userId, undefined, false);
        modalProps.onClose();
    }

    const actions = [
        { text: "Save", variant: "primary", onClick: save, loading: busy }
    ];
    if (existing) actions.unshift({ text: "Remove disguise", variant: "critical-primary", onClick: drop, loading: busy });

    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Disguise"
            subtitle="Everything below only changes what you see."
            actions={actions}
        >
            <Paragraph>Pick the account this person should look like. Their name, avatar and profile are replaced with it everywhere in your client.</Paragraph>

            <div className={cl("picker")}>
                <FriendPicker
                    value={preview}
                    onChange={(user: User | null) => setTemplateId(user?.id ?? "")}
                    placeholder="Pick a friend…"
                />
                <TextInput
                    value={templateId}
                    onChange={setTemplateId}
                    placeholder="…or paste an account ID"
                />
            </div>

            {preview && (
                <div className={cl("preview")}>
                    <Avatar src={IconUtils.getUserAvatarURL(preview, false, 40)} size="SIZE_40" />
                    <BaseText size="md" weight="semibold">{preview.globalName || preview.username}</BaseText>
                </div>
            )}
        </Modal>
    );
}
