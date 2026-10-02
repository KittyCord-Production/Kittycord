/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface IconItem {
    kind: "emoji" | "sticker";
    id: string;
    name: string;
    url: string;
}

export type IconFormat = "markdown" | "json" | "urls";

const cell = (value: string) => value.replace(/\|/g, "\\|");

export function formatIcons(items: IconItem[], format: IconFormat) {
    if (format === "urls") return items.map(i => i.url).join("\n");

    if (format === "json") {
        return JSON.stringify(items, null, 2);
    }

    const rows = items.map(i => {
        const preview = i.url.endsWith(".json") ? "" : `![](${i.url}?size=48)`;
        return `| ${preview} | ${i.kind} | ${cell(i.name)} | ${i.id} | ${i.url} |`;
    });

    return ["| Preview | Type | Name | ID | URL |", "|---|---|---|---|---|", ...rows].join("\n");
}
