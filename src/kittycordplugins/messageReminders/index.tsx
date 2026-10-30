/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId } from "@api/ContextMenu";
import { get, set } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Message, RenderModalProps } from "@vencord/discord-types";
import { ChannelStore, Menu, MessageActions, React, showToast } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";

const KEY = "Kittycord_Reminders";

interface Reminder {
    id: string;
    messageId: string;
    channelId: string;
    author: string;
    content: string;
    remindAt: number;
}

let reminders: Reminder[] = [];
let timer: ReturnType<typeof setInterval> | null = null;

async function load() {
    reminders = (await get<Reminder[]>(KEY)) ?? [];
}

async function save() {
    await set(KEY, reminders);
}

function atHour(hour: number, dayOffset = 0) {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d.getTime() + dayOffset * 86_400_000;
}

const PRESETS: { label: string; at: () => number; }[] = [
    { label: "In 30 minutes", at: () => Date.now() + 30 * 60_000 },
    { label: "In 1 hour", at: () => Date.now() + 60 * 60_000 },
    { label: "In 3 hours", at: () => Date.now() + 3 * 60 * 60_000 },
    { label: "This evening", at: () => atHour(18) > Date.now() ? atHour(18) : atHour(18, 1) },
    { label: "Tomorrow morning", at: () => atHour(9, 1) }
];

async function addReminder(msg: Message, remindAt: number) {
    reminders = [...reminders, {
        id: `${msg.id}-${remindAt}`,
        messageId: msg.id,
        channelId: msg.channel_id,
        author: msg.author?.username ?? "Unknown",
        content: (msg.content || "").slice(0, 140),
        remindAt
    }];
    await save();
    showToast({ text: `Reminder set for ${new Date(remindAt).toLocaleString()}.`, variant: "success" });
}

function fire(r: Reminder) {
    showNotification({
        title: `Reminder: message from ${r.author}`,
        body: r.content || "Jump to the message you saved.",
        onClick: () => MessageActions.jumpToMessage({ channelId: r.channelId, messageId: r.messageId, flash: true })
    });
}

async function checkDue() {
    const now = Date.now();
    const due = reminders.filter(r => r.remindAt <= now);
    if (!due.length) return;
    reminders = reminders.filter(r => r.remindAt > now);
    await save();
    due.forEach(fire);
}

function RemindersModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [list, setList] = React.useState<Reminder[]>([...reminders].sort((a, b) => a.remindAt - b.remindAt));

    function cancel(id: string) {
        reminders = reminders.filter(r => r.id !== id);
        save();
        setList([...reminders].sort((a, b) => a.remindAt - b.remindAt));
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text size="lg" weight="semibold" style={{ flexGrow: 1 }}>Reminders ({list.length})</Text>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {list.length === 0
                    ? <Text style={{ padding: "16px 0" }}>No reminders yet. Right-click a message and choose Remind me.</Text>
                    : list.map(r => (
                        <Flex key={r.id} style={{ padding: "8px 0", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text size="sm" weight="semibold">{new Date(r.remindAt).toLocaleString()}</Text>
                                <Text size="sm" style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {r.author}: {r.content || "(no text)"}
                                </Text>
                            </div>
                            <Button size="small" onClick={() => {
                                MessageActions.jumpToMessage({ channelId: r.channelId, messageId: r.messageId, flash: true });
                                rootProps.onClose();
                            }}>Jump</Button>
                            <Button size="small" variant="dangerPrimary" onClick={() => cancel(r.id)}>Cancel</Button>
                        </Flex>
                    ))}
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "MessageReminders",
    description: "Right-click a message to be reminded about it later. A notification brings you right back to it.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Chat"],

    contextMenus: {
        "message"(children, { message }: { message: Message; }) {
            if (!message?.id || !ChannelStore.getChannel(message.channel_id)) return;
            const group = findGroupChildrenByChildId("pin", children) ?? children;
            group.push(
                <Menu.MenuItem id="kc-remind" label="Remind me">
                    {PRESETS.map(p => (
                        <Menu.MenuItem
                            key={p.label}
                            id={"kc-remind-" + p.label}
                            label={p.label}
                            action={() => addReminder(message, p.at())}
                        />
                    ))}
                </Menu.MenuItem>
            );
        }
    },

    toolboxActions: {
        "Open Reminders"() {
            openModal(props => <RemindersModal rootProps={props} />);
        }
    },

    async start() {
        await load();
        await checkDue();
        timer = setInterval(checkDue, 30_000);
    },

    stop() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        reminders = [];
    }
});
