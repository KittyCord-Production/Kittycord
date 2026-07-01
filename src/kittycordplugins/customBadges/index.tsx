/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import definePlugin, { OptionType } from "@utils/types";
import { Button, React, showToast, Text, TextInput, Toasts, Tooltip, UserStore } from "@webpack/common";

interface CustomBadge {
    emoji: string;
    label: string;
}

const MAX_SLOTS = 5;
const Native = VencordNative.kittycordBadges;
const customBadges = new Map<string, Array<CustomBadge | undefined>>();

const isUrl = (s: string) => /^https:\/\//i.test(s);

export async function refreshBadges() {
    const list = await Native.getBadges();
    customBadges.clear();
    for (const b of list) {
        if (!customBadges.has(b.id)) customBadges.set(b.id, []);
        customBadges.get(b.id)![b.slot] = { emoji: b.emoji, label: b.label };
    }
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

function makeSlotBadge(slot: number): ProfileBadge {
    return {
        id: `kittycord-custom-${slot}`,
        key: `kittycord-custom-${slot}`,
        position: BadgePosition.END,
        shouldShow: ({ userId }) => !!customBadges.get(userId)?.[slot],
        component: ({ userId }) => {
            const b = customBadges.get(userId)?.[slot];
            if (!b) return null;
            return (
                <Tooltip text={b.label}>
                    {tp => isUrl(b.emoji)
                        ? <img {...tp} src={b.emoji} height={16} style={{ borderRadius: 4, verticalAlign: "middle" }} alt="" />
                        : <span {...tp} style={{ fontSize: 14, lineHeight: 1, cursor: "default" }}>{b.emoji}</span>}
                </Tooltip>
            );
        }
    };
}

const profileBadges = Array.from({ length: MAX_SLOTS }, (_, i) => makeSlotBadge(i));

interface BadgeEntry {
    slot: number;
    icon: string;
    label: string;
    persisted: boolean;
}

function BadgeEditor() {
    const [entries, setEntries] = React.useState<BadgeEntry[]>([]);
    const [busy, setBusy] = React.useState(false);

    async function load() {
        await refreshBadges();
        const me = UserStore.getCurrentUser();
        if (!me) return;
        const slots = customBadges.get(me.id) ?? [];
        const loaded: BadgeEntry[] = [];
        for (let i = 0; i < MAX_SLOTS; i++) {
            const b = slots[i];
            if (b) loaded.push({ slot: i, icon: b.emoji, label: b.label, persisted: true });
        }
        setEntries(loaded);
    }

    React.useEffect(() => { load(); }, []);

    function addEntry() {
        if (entries.length >= MAX_SLOTS) return;
        const usedSlots = new Set(entries.map(e => e.slot));
        let slot = 0;
        while (usedSlots.has(slot)) slot++;
        setEntries(prev => [...prev, { slot, icon: "", label: "", persisted: false }]);
    }

    function updateEntry(slot: number, key: "icon" | "label", value: string) {
        setEntries(prev => prev.map(e => e.slot === slot ? { ...e, [key]: value } : e));
    }

    async function saveEntry(slot: number) {
        const me = UserStore.getCurrentUser();
        if (!me?.id) return;
        const entry = entries.find(e => e.slot === slot);
        if (!entry) return;
        const i = entry.icon.trim();
        const l = entry.label.trim();
        if (!i) { showToast("Add an emoji or an image/GIF link.", Toasts.Type.FAILURE); return; }
        if (/^https?:\/\//i.test(i) && !isUrl(i)) { showToast("Image links must use https.", Toasts.Type.FAILURE); return; }
        if (!l) { showToast("Add a short label.", Toasts.Type.FAILURE); return; }

        setBusy(true);
        const res = await Native.setBadge(me.id, i, l, slot);
        setBusy(false);
        if (res.ok) {
            await refreshBadges();
            setEntries(prev => prev.map(e => e.slot === slot ? { ...e, persisted: true } : e));
            showToast("Badge saved.", Toasts.Type.SUCCESS);
        } else {
            showToast(res.error ?? "Could not save the badge.", Toasts.Type.FAILURE);
        }
    }

    async function removeEntry(slot: number) {
        const entry = entries.find(e => e.slot === slot);
        if (!entry) return;
        if (entry.persisted) {
            const me = UserStore.getCurrentUser();
            if (!me?.id) return;
            setBusy(true);
            await Native.clearBadge(me.id, slot);
            setBusy(false);
            await refreshBadges();
            showToast("Badge removed.", Toasts.Type.SUCCESS);
        }
        setEntries(prev => prev.filter(e => e.slot !== slot));
    }

    return (
        <>
            <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Your custom badges</Text>
            <Text variant="text-sm/normal" style={{ opacity: 0.8, marginBottom: 8 }}>
                Use an emoji or an https image/GIF link (Tenor, Imgur, Discord and Catbox load best) plus a short label. Up to {MAX_SLOTS} badges. They show on your profile for everyone using Kittycord.
            </Text>
            {entries.map(entry => (
                <Flex key={entry.slot} style={{ gap: 8, alignItems: "center", marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                        <TextInput
                            value={entry.icon}
                            onChange={v => updateEntry(entry.slot, "icon", v)}
                            placeholder="🐱 or https://…/badge.gif"
                            maxLength={512}
                        />
                    </div>
                    <div style={{ width: 150 }}>
                        <TextInput
                            value={entry.label}
                            onChange={v => updateEntry(entry.slot, "label", v)}
                            placeholder="catgirl"
                            maxLength={24}
                        />
                    </div>
                    {entry.icon
                        ? isUrl(entry.icon)
                            ? <img src={entry.icon} height={22} style={{ borderRadius: 4 }} alt="" />
                            : <span style={{ fontSize: 20 }}>{entry.icon}</span>
                        : null}
                    <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} disabled={busy} onClick={() => saveEntry(entry.slot)}>
                        Save
                    </Button>
                    <Button color={Button.Colors.RED} look={Button.Looks.LINK} size={Button.Sizes.SMALL} disabled={busy} onClick={() => removeEntry(entry.slot)}>
                        Remove
                    </Button>
                </Flex>
            ))}
            {entries.length < MAX_SLOTS && (
                <Button
                    color={Button.Colors.GREEN}
                    size={Button.Sizes.SMALL}
                    onClick={addEntry}
                    style={{ marginTop: 4 }}
                >
                    + Add badge
                </Button>
            )}
        </>
    );
}

const settings = definePluginSettings({
    badges: {
        type: OptionType.COMPONENT,
        description: "Your custom badges",
        component: BadgeEditor
    }
});

export default definePlugin({
    name: "CustomBadges",
    description: "Give yourself a custom profile badge — an emoji or an image/GIF link plus a short label — that everyone on Kittycord can see.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["BadgeAPI"],
    enabledByDefault: true,
    settings,

    async start() {
        for (const b of profileBadges) addProfileBadge(b);
        await refreshBadges();
        refreshTimer = setInterval(refreshBadges, 10 * 60 * 1000);
    },

    stop() {
        for (const b of profileBadges) removeProfileBadge(b);
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        customBadges.clear();
    }
});
