/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import type { User } from "@vencord/discord-types";
import { Button, React, RelationshipStore, SearchableSelect, showToast, Text, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { ensureDmChannel } from "../_shared/dm";
import { packsAvailable, quickShare } from "./PackGallery";
import { CustomCommand, exportCommands } from "./settings";

const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const logger = new Logger("CommandStudio");
const NAME_RE = /^[\w\-'!&. ]{1,40}$/;

function packName(commands: CustomCommand[]): string {
    if (commands.length === 1 && NAME_RE.test(commands[0].trigger)) return commands[0].trigger;
    return "Shared commands";
}

function ShareDialog({ rootProps, commands, label }: { rootProps: any; commands: CustomCommand[]; label: string; }) {
    const [payload, setPayload] = React.useState<string | null>(packsAvailable() ? null : exportCommands(commands));
    const [target, setTarget] = React.useState<User | null>(null);
    const [busy, setBusy] = React.useState(false);

    const friendOptions = React.useMemo(() =>
        RelationshipStore.getFriendIDs()
            .map(id => UserStore.getUser(id))
            .filter((u): u is User => Boolean(u))
            .map(u => ({ label: u.globalName || u.username, value: u.id }))
            .sort((a, b) => a.label.localeCompare(b.label)), []);

    React.useEffect(() => {
        if (!packsAvailable()) return;

        let cancelled = false;
        quickShare(packName(commands), commands)
            .then(link => { if (!cancelled) setPayload(link); })
            .catch(e => {
                logger.warn("quick share link failed, falling back to a code", e);
                if (!cancelled) setPayload(exportCommands(commands));
            });

        return () => { cancelled = true; };
    }, []);

    async function send() {
        if (!target || !payload) return;
        setBusy(true);
        try {
            const channelId = await ensureDmChannel(target.id);
            if (!channelId) throw new Error("Could not open a DM with them.");

            await sendMessage(channelId, { content: `Here's a command for you 🐱\n${payload}` });
            showToast(`Sent to ${target.globalName || target.username}.`, Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send that."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Share {label}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" style={{ opacity: 0.85, margin: "12px 0" }}>
                    They get a one-tap prompt to add it. Only the commands you picked are shared.
                </Text>

                <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Send to a friend</Text>
                <SearchableSelect
                    options={friendOptions}
                    value={target?.id}
                    placeholder="Pick a friend…"
                    onChange={(v: string) => setTarget(UserStore.getUser(v) ?? null)}
                    closeOnSelect
                />

                <Text
                    variant="text-sm/normal"
                    style={{ margin: "12px 0", opacity: 0.7, userSelect: "text", overflowWrap: "anywhere" }}
                >
                    {payload ?? "Preparing a link…"}
                </Text>

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} disabled={!target || !payload || busy} onClick={send}>Send</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export function openShareModal(commands: CustomCommand[], label: string) {
    if (!commands.length) {
        showToast("Create a command first — then you can share it.", Toasts.Type.FAILURE);
        return;
    }
    openModal(props => <ShareDialog rootProps={props} commands={commands} label={label} />);
}
