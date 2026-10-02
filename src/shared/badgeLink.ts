/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const MAX_BADGE_LINK_LEN = 300;

export function parseBadgeLink(raw: unknown): URL | null {
    if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_BADGE_LINK_LEN) return null;

    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }

    if (url.protocol !== "https:" || url.username || url.password) return null;
    if (url.href.length > MAX_BADGE_LINK_LEN) return null;

    const host = url.hostname;
    if (!host.includes(".") || host.startsWith("[") || /^[\d.]+$/.test(host)) return null;

    return url;
}
