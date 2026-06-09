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

const Native = VencordNative.kittycordBadges;
const customBadges = new Map<string, CustomBadge>();

const isUrl = (s: string) => /^https:\/\//i.test(s);

async function refreshBadges() {
    const list = await Native.getBadges();
    customBadges.clear();
    for (const b of list) customBadges.set(b.id, { emoji: b.emoji, label: b.label });
}

let refreshTimer: ReturnType<typeof setInterval> | null = null;

const CustomBadge: ProfileBadge = {
    id: "kittycord-custom",
    key: "kittycord-custom",
    position: BadgePosition.END,
    shouldShow: ({ userId }) => customBadges.has(userId),
    component: ({ userId }) => {
        const b = customBadges.get(userId);
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

function BadgeEditor() {
    const [icon, setIcon] = React.useState("");
    const [label, setLabel] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            await refreshBadges();
            const me = UserStore.getCurrentUser();
            const mine = me && customBadges.get(me.id);
            if (mine) { setIcon(mine.emoji); setLabel(mine.label); }
        })();
    }, []);

    async function save() {
        const me = UserStore.getCurrentUser();
        if (!me?.id) return;
        const i = icon.trim();
        const l = label.trim();
        if (!i) { showToast("Add an emoji or an image/GIF link.", Toasts.Type.FAILURE); return; }
        if (/^https?:\/\//i.test(i) && !isUrl(i)) { showToast("Image links must use https.", Toasts.Type.FAILURE); return; }
        if (!l) { showToast("Add a short label.", Toasts.Type.FAILURE); return; }

        setBusy(true);
        const res = await Native.setBadge(me.id, i, l);
        setBusy(false);
        if (res.ok) { await refreshBadges(); showToast("Badge saved.", Toasts.Type.SUCCESS); }
        else showToast(res.error ?? "Could not save the badge.", Toasts.Type.FAILURE);
    }

    async function clear() {
        const me = UserStore.getCurrentUser();
        if (!me?.id) return;
        setBusy(true);
        await Native.clearBadge(me.id);
        setBusy(false);
        setIcon("");
        setLabel("");
        await refreshBadges();
        showToast("Badge removed.", Toasts.Type.SUCCESS);
    }

    return (
        <>
            <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Your custom badge</Text>
            <Text variant="text-sm/normal" style={{ opacity: 0.8, marginBottom: 8 }}>
                Use an emoji or an https image/GIF link (Tenor, Imgur, Discord and Catbox load best) plus a short label. It shows on your profile for everyone using Kittycord.
            </Text>
            <Flex style={{ gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                    <TextInput value={icon} onChange={setIcon} placeholder="🐱 or https://…/badge.gif" maxLength={512} />
                </div>
                <div style={{ width: 150 }}>
                    <TextInput value={label} onChange={setLabel} placeholder="catgirl" maxLength={24} />
                </div>
                {icon ? (isUrl(icon)
                    ? <img src={icon} height={22} style={{ borderRadius: 4 }} alt="" />
                    : <span style={{ fontSize: 20 }}>{icon}</span>) : null}
            </Flex>
            <Flex style={{ gap: 8, marginTop: 8 }}>
                <Button color={Button.Colors.BRAND} disabled={busy} onClick={save}>Save badge</Button>
                <Button color={Button.Colors.RED} look={Button.Looks.LINK} disabled={busy} onClick={clear}>Remove</Button>
            </Flex>
        </>
    );
}

const settings = definePluginSettings({
    badge: {
        type: OptionType.COMPONENT,
        description: "Your custom badge",
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
        addProfileBadge(CustomBadge);
        await refreshBadges();
        refreshTimer = setInterval(refreshBadges, 10 * 60 * 1000);
    },

    stop() {
        removeProfileBadge(CustomBadge);
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        customBadges.clear();
    }
});
