/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { OnlineStatus } from "@vencord/discord-types";
import { PresenceStore } from "@webpack/common";

export type StatusBucket = "online" | "idle" | "dnd" | "offline";

const BUCKET_INFO: Record<StatusBucket, { label: string; color: string; body: string; }> = {
    online: { label: "Online", color: "var(--text-status-online)", body: "is now online" },
    idle: { label: "Idle", color: "var(--text-status-idle)", body: "went idle" },
    dnd: { label: "Do Not Disturb", color: "var(--text-status-dnd)", body: "is on Do Not Disturb" },
    offline: { label: "Offline", color: "var(--text-status-offline)", body: "went offline" }
};

export const BUCKETS = (Object.keys(BUCKET_INFO) as StatusBucket[]).map(key => ({ key, ...BUCKET_INFO[key] }));

export function bucketLabel(bucket: StatusBucket): string {
    return BUCKET_INFO[bucket].label;
}

export function bucketColor(bucket: StatusBucket): string {
    return BUCKET_INFO[bucket].color;
}

export function bucketBody(bucket: StatusBucket): string {
    return BUCKET_INFO[bucket].body;
}

export function bucketOf(status: OnlineStatus | undefined): StatusBucket | null {
    switch (status) {
        case "online":
        case "streaming":
            return "online";
        case "idle":
            return "idle";
        case "dnd":
            return "dnd";
        case "offline":
        case "invisible":
            return "offline";
        default:
            return null;
    }
}

export function currentBucket(userId: string): StatusBucket | null {
    return bucketOf(PresenceStore.getStatus(userId));
}
