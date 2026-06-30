/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { eyesFor, GHOST_ACCESSORIES, GHOST_ACCESSORY_LEVELS, GHOST_ACCESSORY_THUMBS, GhostExpression } from "./ghostArt";

const FUR = "#9ba1aa";
const FUR_DARK = "#6f757e";
const MASK = "#38323d";
const LIGHT = "#eef0f3";
const NOSE = "#2e2730";

const TAIL = `<g transform="rotate(26 25 27)"><rect x="22.4" y="20.5" width="6.6" height="12.5" rx="3.3" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><rect x="22.4" y="23.5" width="6.6" height="2.5" fill="${MASK}"/><rect x="22.4" y="27.5" width="6.6" height="2.5" fill="${MASK}"/><rect x="22.4" y="31.5" width="6.6" height="1.5" fill="${MASK}"/></g>`;

const EARS = `<circle cx="8.5" cy="7.2" r="3.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><circle cx="8.5" cy="7.5" r="1.7" fill="${LIGHT}"/><circle cx="23.5" cy="7.2" r="3.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><circle cx="23.5" cy="7.5" r="1.7" fill="${LIGHT}"/>`;

const BODY = `<ellipse cx="16" cy="27.5" rx="8" ry="4.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.2"/><ellipse cx="16" cy="28.4" rx="4.2" ry="3" fill="${LIGHT}"/><ellipse cx="7.6" cy="24.5" rx="2.6" ry="3.4" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><ellipse cx="24.4" cy="24.5" rx="2.6" ry="3.4" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/>`;

const HEAD = `<circle cx="16" cy="14" r="10.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.2"/>`;

const MASK_BAND = `<ellipse cx="12" cy="14.6" rx="4" ry="3.6" fill="${MASK}"/><ellipse cx="20" cy="14.6" rx="4" ry="3.6" fill="${MASK}"/><rect x="13.4" y="13" width="5.2" height="2.8" fill="${MASK}"/><path d="M6 12.5 Q5 10 7 9.2" fill="none" stroke="${MASK}" stroke-width="1.4" stroke-linecap="round"/><path d="M26 12.5 Q27 10 25 9.2" fill="none" stroke="${MASK}" stroke-width="1.4" stroke-linecap="round"/>`;

const WHITES = "<ellipse cx=\"12.5\" cy=\"15\" rx=\"2.5\" ry=\"3\" fill=\"#ffffff\"/><ellipse cx=\"19.5\" cy=\"15\" rx=\"2.5\" ry=\"3\" fill=\"#ffffff\"/>";

const SNOUT = `<ellipse cx="16" cy="19.4" rx="4.4" ry="3.4" fill="${LIGHT}"/><ellipse cx="16" cy="17.8" rx="1.6" ry="1.1" fill="${NOSE}"/><path d="M16 18.8 Q16 20.1 14.7 20.3" fill="none" stroke="${NOSE}" stroke-width="0.7" stroke-linecap="round"/><path d="M16 18.8 Q16 20.1 17.3 20.3" fill="none" stroke="${NOSE}" stroke-width="0.7" stroke-linecap="round"/>`;

const RACCOON = TAIL + EARS + BODY + HEAD + MASK_BAND + WHITES + SNOUT;

const uriCache = new Map<string, string>();

function toUri(inner: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildRaccoonUri({ expression, accessory }: { expression: GhostExpression; accessory: string | null; }): string {
    const key = `${expression}|${accessory ?? ""}`;
    const cached = uriCache.get(key);
    if (cached) return cached;
    const acc = accessory && GHOST_ACCESSORIES[accessory] ? GHOST_ACCESSORIES[accessory].svg : "";
    const uri = toUri(RACCOON + eyesFor(expression) + acc);
    uriCache.set(key, uri);
    return uri;
}

export const RACCOON_ACCESSORIES = GHOST_ACCESSORIES;
export const RACCOON_ACCESSORY_LEVELS = GHOST_ACCESSORY_LEVELS;
export const RACCOON_ACCESSORY_THUMBS = GHOST_ACCESSORY_THUMBS;
