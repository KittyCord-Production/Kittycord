/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { getUniqueUsername } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import type { User } from "@vencord/discord-types";
import { Button, IconUtils, React, RelationshipStore, SearchableSelect, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { sendFileToUser } from "./dm";
import { INVITE_FILENAME, renderInviteCard } from "./inviteCard";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const logger = new Logger("InviteFriend");

const DEFAULT_MESSAGE = "Come join me on Kittycord — it makes Discord way cuter & comfier 🐱 https://kittycord.dev";

function withCodeMessage(code: string) {
    return `${DEFAULT_MESSAGE}\n(optional: my creator code "${code}" — pop it into the installer when you set it up, it just credits me 💖)`;
}

function InviteModal({ rootProps, user }: { rootProps: any; user: User | null; }) {
    const [target, setTarget] = React.useState<User | null>(user);
    const [note, setNote] = React.useState(DEFAULT_MESSAGE);
    const [myCode, setMyCode] = React.useState<string | null>(null);
    const editedRef = React.useRef(false);
    const codePromiseRef = React.useRef<Promise<string | null> | null>(null);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
    const [blob, setBlob] = React.useState<Blob | null>(null);
    const [busy, setBusy] = React.useState(false);

    const friendOptions = React.useMemo(() => {
        if (user) return [];
        return RelationshipStore.getFriendIDs()
            .map(id => UserStore.getUser(id))
            .filter((u): u is User => Boolean(u))
            .map(u => ({ label: u.globalName || u.username, value: u.id }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [user]);

    React.useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        (async () => {
            try {
                const me = UserStore.getCurrentUser();
                const name = me ? (me.globalName || me.username) : "A friend";
                const avatar = me ? IconUtils.getUserAvatarURL(me, true, 256) : null;
                const result = await renderInviteCard(name, avatar);
                if (cancelled) return;
                url = URL.createObjectURL(result);
                setBlob(result);
                setPreviewUrl(url);
            } catch (e) {
                logger.error("Failed to render invite card", e);
                if (!cancelled) showToast("Could not render the invite card.", Toasts.Type.FAILURE);
            }
        })();
        return () => {
            cancelled = true;
            if (url) URL.revokeObjectURL(url);
        };
    }, []);

    function loadMyCode(): Promise<string | null> {
        if (!codePromiseRef.current) {
            codePromiseRef.current = (async () => {
                try {
                    const me = UserStore.getCurrentUser();
                    const Native = (VencordNative as any)?.pluginHelpers?.KittyInvites;
                    if (!me || !Native?.getMe) return null;
                    const mine = await Native.getMe(me.id);
                    return typeof mine?.code === "string" ? mine.code : null;
                } catch {
                    return null;
                }
            })();
        }
        return codePromiseRef.current;
    }

    React.useEffect(() => {
        let cancelled = false;
        loadMyCode().then(code => {
            if (cancelled || !code) return;
            setMyCode(code);
            if (!editedRef.current) setNote(withCodeMessage(code));
        });
        return () => { cancelled = true; };
    }, []);

    async function send() {
        if (!blob || !target) return;
        setBusy(true);
        try {
            const code = await loadMyCode();
            const message = (!editedRef.current && code ? withCodeMessage(code) : note.trim()) || DEFAULT_MESSAGE;
            const file = new File([blob], INVITE_FILENAME, { type: "image/png" });
            await sendFileToUser(target.id, file, message);
            showToast(`Invite sent to ${target.globalName || target.username}. 💌`, Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send the invite."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Invite a friend to Kittycord</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                    {previewUrl
                        ? <img src={previewUrl} alt="Kittycord invite card" style={{ width: "100%", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                        : <Text variant="text-md/normal" style={{ padding: "48px 0", opacity: 0.7 }}>Rendering the invite…</Text>}
                </div>

                {!user && (
                    <>
                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Send to</Text>
                        <SearchableSelect
                            options={friendOptions}
                            value={target?.id}
                            placeholder="Pick a friend…"
                            onChange={(v: string) => setTarget(UserStore.getUser(v) ?? null)}
                            closeOnSelect
                        />
                    </>
                )}
                {user && (
                    <Text variant="text-sm/normal" style={{ opacity: 0.8 }}>
                        Sends {getUniqueUsername(user)} this card with your message — works even if they don't have Kittycord yet.
                    </Text>
                )}

                <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>Message</Text>
                <TextInput value={note} onChange={v => { editedRef.current = true; setNote(v); }} />
                {myCode
                    ? <Text variant="text-sm/normal" style={{ marginTop: 6, opacity: 0.8 }}>
                        Your creator code <span style={{ color: "var(--brand-500)", fontWeight: 600 }}>{myCode}</span> is included — your friend enters it in the installer (or Settings → Invites) to credit you. 💖
                    </Text>
                    : <Text variant="text-sm/normal" style={{ marginTop: 6, opacity: 0.6 }}>
                        Tip: set a creator code in Settings → Invites so the friends you invite count toward you.
                    </Text>}

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} disabled={!blob || !target || busy} onClick={send}>Send invite</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export function openInvite(user: User | null) {
    openModal(props => <InviteModal rootProps={props} user={user} />);
}
