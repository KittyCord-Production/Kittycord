/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import definePlugin, { OptionType } from "@utils/types";

// Discord's online status user-setting (same one AutoDNDWhilePlaying uses).
const StatusSetting = getUserSettingLazy<string>("status", "status");

let savedStatus: string | null = null;
let forcedStatus: string | null = null;
let overridden = false;
let timer: ReturnType<typeof setInterval> | null = null;

const settings = definePluginSettings({
    startTime: {
        type: OptionType.STRING,
        description: "Quiet hours start (24-hour, HH:mm)",
        default: "23:00"
    },
    endTime: {
        type: OptionType.STRING,
        description: "Quiet hours end (24-hour, HH:mm)",
        default: "08:00"
    },
    quietStatus: {
        type: OptionType.SELECT,
        description: "Status to set during quiet hours",
        options: [
            { label: "Online", value: "online" },
            { label: "Idle", value: "idle" },
            { label: "Do Not Disturb", value: "dnd", default: true },
            { label: "Invisible", value: "invisible" }
        ],
        onChange() {
            forcedStatus = null;
        }
    },
    restore: {
        type: OptionType.SELECT,
        description: "When quiet hours end, set status to",
        options: [
            { label: "Restore previous status", value: "previous", default: true },
            { label: "Online", value: "online" },
            { label: "Idle", value: "idle" },
            { label: "Do Not Disturb", value: "dnd" },
            { label: "Invisible", value: "invisible" }
        ]
    }
});

function toMinutes(s: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec((s ?? "").trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
}

function isQuietNow(): boolean {
    const start = toMinutes(settings.store.startTime);
    const end = toMinutes(settings.store.endTime);
    if (start == null || end == null || start === end) return false;

    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();

    // Same-day window vs. window crossing midnight.
    return start < end ? (cur >= start && cur < end) : (cur >= start || cur < end);
}

function tick() {
    if (!StatusSetting) return;
    const cur = StatusSetting.getSetting?.() ?? "online";

    if (isQuietNow()) {
        if (overridden) return;

        const want = settings.store.quietStatus;
        if (cur === want) {
            forcedStatus = want;
            return;
        }

        if (forcedStatus != null) {
            overridden = true;
            forcedStatus = null;
            savedStatus = null;
            return;
        }

        if (savedStatus == null) savedStatus = cur;
        forcedStatus = want;
        StatusSetting.updateSetting(want);
        return;
    }

    overridden = false;
    forcedStatus = null;

    if (savedStatus != null) {
        const target = settings.store.restore === "previous" ? savedStatus : settings.store.restore;
        savedStatus = null;
        if (cur !== target) StatusSetting.updateSetting(target);
    }
}

export default definePlugin({
    name: "QuietHours",
    description: "Automatically set your status (e.g. Do Not Disturb) during a daily time window, then restore it afterwards.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    settings,

    start() {
        overridden = false;
        forcedStatus = null;
        tick();
        timer = setInterval(tick, 30_000);
    },

    stop() {
        if (timer) clearInterval(timer);
        timer = null;
        overridden = false;
        forcedStatus = null;
        // Restore status if we changed it and the plugin is being turned off mid-window.
        if (savedStatus != null && StatusSetting) {
            const cur = StatusSetting.getSetting?.() ?? "online";
            if (cur !== savedStatus) StatusSetting.updateSetting(savedStatus);
            savedStatus = null;
        }
    }
});
