/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const DEKO_CDN = "https://kittycord-analytics.hell-bullet-hb.workers.dev/deko/assets";
export const KITTY_DEKO_SKU = "107107100101107111";

export interface Deko {
    id: string;
    label: string;
    animated?: boolean;
}

export const CATALOG: Deko[] = [
    { id: "glow", label: "Pink glow" },
    { id: "hearts", label: "Hearts" },
    { id: "sparkles", label: "Sparkles", animated: true },
    { id: "stars", label: "Starlight", animated: true },
    { id: "ears", label: "Cat ears" },
    { id: "crown", label: "Crown" },
    { id: "bubbles", label: "Bubbles" }
];

export const byId = new Map(CATALOG.map(d => [d.id, d]));

export const assetUrl = (deco: string) => `${DEKO_CDN}/${deco}`;
