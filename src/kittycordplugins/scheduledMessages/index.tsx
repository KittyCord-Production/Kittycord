/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { get, set } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { Flex } from "@components/Flex";
import { getCurrentChannel, sendMessage } from "@utils/discord";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import { Channel } from "@vencord/discord-types";
import { Button, React, SearchableSelect, Text, TextInput } from "@webpack/common";
import type { ComponentType } from "react";

const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const KEY = "Kittycord_Scheduled";
const PINK = "#ff5fa6";
const TICK_MS = 20_000;
const GRACE_MS = 5 * 60_000;
const DAY = 24 * 60 * 60_000;
const WEEK = 7 * DAY;

type Kind = "message" | "reminder";
type Repeat = "none" | "daily" | "weekly";

interface Scheduled {
    id: string;
    kind: Kind;
    channelId: string;
    channelLabel: string;
    content: string;
    fireAt: number;
    repeat: Repeat;
    createdAt: number;
}

let items: Scheduled[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let firing = false;

async function load() {
    items = (await get<Scheduled[]>(KEY)) ?? [];
}

async function save() {
    await set(KEY, items);
}

function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function channelLabelFor(channel: Channel | undefined) {
    if (!channel) return "this channel";
    if (channel.guild_id) return "#" + (channel.name ?? "channel");
    return channel.name || "Direct Message";
}

function fmtRel(ts: number) {
    const d = ts - Date.now();
    if (d <= 0) return "now";
    const m = Math.round(d / 60_000);
    if (m < 60) return `in ${m} min`;
    const h = Math.round(m / 60);
    if (h < 48) return `in ${h} h`;
    return `in ${Math.round(h / 24)} d`;
}

function fmtAbs(ts: number) {
    return new Date(ts).toLocaleString();
}

async function processDue(isStartup: boolean) {
    if (firing) return;
    firing = true;
    try {
        const now = Date.now();
        let changed = false;
        const remaining: Scheduled[] = [];
        for (const item of items) {
            if (item.fireAt > now) {
                remaining.push(item);
                continue;
            }
            const overdue = now - item.fireAt;
            if (item.kind === "message") {
                if (isStartup && overdue > GRACE_MS) {
                    showNotification({ title: "Missed scheduled message", body: `Your message to ${item.channelLabel} was due while Discord was closed.`, color: PINK });
                } else {
                    try { sendMessage(item.channelId, { content: item.content }); } catch { }
                }
            } else {
                showNotification({ title: "Reminder", body: item.content, color: PINK });
            }
            changed = true;
            if (item.repeat !== "none") {
                const step = item.repeat === "daily" ? DAY : WEEK;
                let next = item.fireAt + step;
                while (next <= now) next += step;
                remaining.push({ ...item, fireAt: next });
            }
        }
        if (changed) {
            items = remaining;
            await save();
        }
    } finally {
        firing = false;
    }
}

const KIND_OPTIONS = [
    { label: "Send a message", value: "message" },
    { label: "Remind me", value: "reminder" }
];
const UNIT_OPTIONS = [
    { label: "minutes", value: "minutes" },
    { label: "hours", value: "hours" },
    { label: "days", value: "days" }
];
const REPEAT_OPTIONS = [
    { label: "Don't repeat", value: "none" },
    { label: "Every day", value: "daily" },
    { label: "Every week", value: "weekly" }
];

function unitMs(unit: string) {
    return unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : DAY;
}

function ScheduleModal({ rootProps, channelId, channelLabel }: { rootProps: any; channelId: string; channelLabel: string; }) {
    const [kind, setKind] = React.useState<Kind>("message");
    const [content, setContent] = React.useState("");
    const [amount, setAmount] = React.useState("30");
    const [unit, setUnit] = React.useState("minutes");
    const [repeat, setRepeat] = React.useState<Repeat>("none");

    const n = parseInt(amount, 10);
    const valid = content.trim().length > 0 && n > 0;
    const previewAt = Date.now() + (n > 0 ? n : 0) * unitMs(unit);

    function add() {
        if (!valid) return;
        const item: Scheduled = {
            id: newId(),
            kind,
            channelId,
            channelLabel,
            content: content.trim(),
            fireAt: Date.now() + n * unitMs(unit),
            repeat,
            createdAt: Date.now()
        };
        items = [...items, item];
        save();
        showNotification({
            title: kind === "reminder" ? "Reminder set" : "Message scheduled",
            body: `${kind === "reminder" ? "I'll remind you" : "Sending to " + channelLabel} ${fmtRel(item.fireAt)}.`,
            color: PINK
        });
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Schedule</Text>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                <Flex style={{ flexDirection: "column", gap: 12, padding: "12px 0" }}>
                    <div>
                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>What</Text>
                        <SearchableSelect options={KIND_OPTIONS} value={kind} onChange={(v: Kind) => setKind(v)} closeOnSelect />
                    </div>
                    <div>
                        <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>{kind === "reminder" ? "Remind me about" : `Message to ${channelLabel}`}</Text>
                        <TextInput value={content} onChange={setContent} placeholder={kind === "reminder" ? "Take a break, drink water…" : "Type your message…"} />
                    </div>
                    <Flex style={{ gap: 8, alignItems: "flex-end" }}>
                        <div style={{ width: 90 }}>
                            <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>In</Text>
                            <TextInput type="number" value={amount} onChange={setAmount} placeholder="30" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect options={UNIT_OPTIONS} value={unit} onChange={(v: string) => setUnit(v)} closeOnSelect />
                        </div>
                        <div style={{ flex: 1 }}>
                            <SearchableSelect options={REPEAT_OPTIONS} value={repeat} onChange={(v: Repeat) => setRepeat(v)} closeOnSelect />
                        </div>
                    </Flex>
                    <Text variant="text-sm/normal" style={{ opacity: 0.75 }}>{valid ? `${kind === "reminder" ? "Reminds" : "Sends"} at ${fmtAbs(previewAt)}` : "Enter text and a time above."}</Text>
                    <Flex style={{ justifyContent: "flex-end", gap: 8 }}>
                        <Button color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={rootProps.onClose}>Cancel</Button>
                        <Button color={Button.Colors.BRAND} disabled={!valid} onClick={add}>Schedule</Button>
                    </Flex>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function ManagerModal({ rootProps }: { rootProps: any; }) {
    const [list, setList] = React.useState<Scheduled[]>([...items]);

    function cancel(id: string) {
        items = items.filter(i => i.id !== id);
        save();
        setList([...items]);
    }

    const shown = [...list].sort((a, b) => a.fireAt - b.fireAt);

    return (
        <ModalRoot {...rootProps} size={ModalSize.LARGE}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Scheduled ({shown.length})</Text>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {shown.length === 0
                    ? <Text variant="text-md/normal" style={{ padding: "16px 0" }}>Nothing scheduled. Use the clock button in the chat bar to schedule a message or reminder.</Text>
                    : shown.map(item => (
                        <Flex key={item.id} style={{ padding: "8px 0", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="text-sm/semibold">
                                    {item.kind === "reminder" ? "Reminder" : item.channelLabel}
                                    <span style={{ background: "var(--brand-500)", color: "var(--white)", borderRadius: 8, padding: "1px 6px", fontSize: 11, marginLeft: 6 }}>{fmtRel(item.fireAt)}</span>
                                    {item.repeat !== "none" && <span style={{ opacity: 0.6, fontSize: 11, marginLeft: 6 }}>{item.repeat}</span>}
                                </Text>
                                <Text variant="text-sm/normal" style={{ opacity: 0.75, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.content}</Text>
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => cancel(item.id)}>Cancel</Button>
                        </Flex>
                    ))}
            </ModalContent>
        </ModalRoot>
    );
}

function ClockIcon(props: any) {
    return (
        <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" {...props}>
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Zm1-13h-2v6l5 3 1-1.7-4-2.3V7Z" />
        </svg>
    );
}

function openScheduleFor(channelId: string, channelLabel: string) {
    openModal(props => <ScheduleModal rootProps={props} channelId={channelId} channelLabel={channelLabel} />);
}

const ScheduleChatButton: ChatBarButtonFactory = ({ channel, isMainChat }) => {
    if (!isMainChat || !channel) return null;
    return (
        <ChatBarButton tooltip="Schedule a message" onClick={() => openScheduleFor(channel.id, channelLabelFor(channel))}>
            <ClockIcon />
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "ScheduledMessages",
    description: "Compose a message now and send it later (one-off or repeating), or set personal reminders. Everything stays local on your machine. Schedule from the clock button in the chat bar; manage queued items from the Kittycord menu.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Chat"],
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        icon: ClockIcon,
        render: ScheduleChatButton
    },

    toolboxActions: {
        "Schedule a message"() {
            const ch = getCurrentChannel();
            if (ch) openScheduleFor(ch.id, channelLabelFor(ch));
        },
        "Open Scheduler"() {
            openModal(props => <ManagerModal rootProps={props} />);
        }
    },

    async start() {
        await load();
        await processDue(true);
        timer = setInterval(() => processDue(false), TICK_MS);
    },

    stop() {
        if (timer) clearInterval(timer);
        timer = null;
        items = [];
    }
});
