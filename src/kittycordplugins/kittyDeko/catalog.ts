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
    file: string;
    animated?: boolean;
}

export const CATALOG: Deko[] = [
    { id: "sakura", label: "Cherry blossom", file: "sakura.webp", animated: true },
    { id: "galaxy", label: "Galaxy", file: "galaxy.webp", animated: true },
    { id: "neon", label: "Neon", file: "neon.webp", animated: true },
    { id: "ice", label: "Frost", file: "ice.webp", animated: true },
    { id: "flames", label: "Flames", file: "flames.webp", animated: true },
    { id: "wings", label: "Angel wings", file: "wings.webp", animated: true },
    { id: "aura", label: "Kitty aura", file: "aura.webp", animated: true },
    { id: "butterfly", label: "Butterflies", file: "butterfly.webp", animated: true },
    { id: "glow", label: "Pink glow", file: "glow" },
    { id: "hearts", label: "Hearts", file: "hearts" },
    { id: "sparkles", label: "Sparkles", file: "sparkles", animated: true },
    { id: "stars", label: "Starlight", file: "stars", animated: true },
    { id: "ears", label: "Cat ears", file: "ears" },
    { id: "crown", label: "Crown", file: "crown" },
    { id: "bubbles", label: "Bubbles", file: "bubbles" }
];

export const byId = new Map(CATALOG.map(d => [d.id, d]));

export const assetUrl = (deco: string) => `${DEKO_CDN}/${byId.get(deco)?.file ?? deco}`;
