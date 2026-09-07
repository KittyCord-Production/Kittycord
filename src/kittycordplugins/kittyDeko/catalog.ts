/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_API } from "@branding";

export const DEKO_CDN = `${BRAND_API}/deko/assets`;
export const KITTY_DEKO_SKU = "107107100101107111";

export interface Deko {
    id: string;
    label: string;
    file: string;
    minInvites?: number;
    supporterOnly?: boolean;
    price?: number;
}

export const CATALOG: Deko[] = [
    { id: "sakura", label: "Cherry blossom", file: "sakura.svg" },
    { id: "galaxy", label: "Galaxy", file: "galaxy.svg", minInvites: 5 },
    { id: "neon", label: "Neon", file: "neon.svg" },
    { id: "ice", label: "Frost", file: "ice.svg" },
    { id: "flames", label: "Flames", file: "flames.svg" },
    { id: "wings", label: "Angel wings", file: "wings.svg", minInvites: 10 },
    { id: "aura", label: "Kitty aura", file: "aura.svg", minInvites: 1 },
    { id: "butterfly", label: "Butterflies", file: "butterfly.svg" },
    { id: "glow", label: "Pink glow", file: "glow" },
    { id: "hearts", label: "Hearts", file: "hearts" },
    { id: "sparkles", label: "Sparkles", file: "sparkles" },
    { id: "stars", label: "Starlight", file: "stars" },
    { id: "ears", label: "Cat ears", file: "ears" },
    { id: "crown", label: "Crown", file: "crown", minInvites: 25 },
    { id: "bubbles", label: "Bubbles", file: "bubbles" },
    { id: "sunrays", label: "Sun rays", file: "sunrays" },
    { id: "waves", label: "Waves", file: "waves" },
    { id: "shells", label: "Seashells", file: "shells" },
    { id: "sunset", label: "Sunset", file: "sunset", minInvites: 3 },
    { id: "palms", label: "Palms", file: "palms", minInvites: 15 },
    { id: "halo", label: "Golden halo", file: "halo", supporterOnly: true },
    { id: "goldheart", label: "Golden hearts", file: "goldheart", supporterOnly: true },
    { id: "celestial", label: "Celestial", file: "celestial", supporterOnly: true },
    { id: "comet", label: "Comet", file: "comet", price: 1500 },
    { id: "koi", label: "Koi pond", file: "koi", price: 2500 },
    { id: "aurora", label: "Aurora", file: "aurora", price: 5000 },
    { id: "cosmos", label: "Cosmos", file: "cosmos", price: 10000 }
];

export const byId = new Map(CATALOG.map(d => [d.id, d]));
export const PRICED_IDS = new Set(CATALOG.filter(d => d.price !== undefined).map(d => d.id));

const ASSET_VERSION = "2";
export const assetUrl = (deco: string) => `${DEKO_CDN}/${byId.get(deco)?.file ?? deco}?v=${ASSET_VERSION}`;
