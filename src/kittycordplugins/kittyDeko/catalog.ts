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
    minInvites?: number;
    supporterOnly?: boolean;
}

export const CATALOG: Deko[] = [
    { id: "sakura", label: "Cherry blossom", file: "sakura.svg", animated: true },
    { id: "galaxy", label: "Galaxy", file: "galaxy.svg", animated: true, minInvites: 5 },
    { id: "neon", label: "Neon", file: "neon.svg", animated: true },
    { id: "ice", label: "Frost", file: "ice.svg", animated: true },
    { id: "flames", label: "Flames", file: "flames.svg", animated: true },
    { id: "wings", label: "Angel wings", file: "wings.svg", animated: true, minInvites: 10 },
    { id: "aura", label: "Kitty aura", file: "aura.svg", animated: true, minInvites: 1 },
    { id: "butterfly", label: "Butterflies", file: "butterfly.svg", animated: true },
    { id: "glow", label: "Pink glow", file: "glow" },
    { id: "hearts", label: "Hearts", file: "hearts" },
    { id: "sparkles", label: "Sparkles", file: "sparkles", animated: true },
    { id: "stars", label: "Starlight", file: "stars", animated: true },
    { id: "ears", label: "Cat ears", file: "ears" },
    { id: "crown", label: "Crown", file: "crown", minInvites: 25 },
    { id: "bubbles", label: "Bubbles", file: "bubbles" },
    { id: "sunrays", label: "Sun rays", file: "sunrays", animated: true },
    { id: "waves", label: "Waves", file: "waves", animated: true },
    { id: "shells", label: "Seashells", file: "shells" },
    { id: "sunset", label: "Sunset", file: "sunset", minInvites: 3 },
    { id: "palms", label: "Palms", file: "palms", minInvites: 15 },
    { id: "halo", label: "Golden halo", file: "halo", animated: true, supporterOnly: true },
    { id: "goldheart", label: "Golden hearts", file: "goldheart", supporterOnly: true },
    { id: "celestial", label: "Celestial", file: "celestial", animated: true, supporterOnly: true }
];

export const byId = new Map(CATALOG.map(d => [d.id, d]));

const ASSET_VERSION = "2";
export const assetUrl = (deco: string) => `${DEKO_CDN}/${byId.get(deco)?.file ?? deco}?v=${ASSET_VERSION}`;
