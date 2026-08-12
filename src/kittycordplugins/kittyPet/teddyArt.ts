/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { eyesFor, GHOST_ACCESSORIES, GhostExpression } from "./ghostArt";

const FUR = "#c98a5a";
const FUR_DARK = "#a86f44";
const CREAM = "#f3dcc2";
const NOSE = "#5a3a2a";

const EARS = `<circle cx="8.5" cy="7.5" r="3.6" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><circle cx="8.5" cy="7.9" r="1.7" fill="${CREAM}"/><circle cx="23.5" cy="7.5" r="3.6" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><circle cx="23.5" cy="7.9" r="1.7" fill="${CREAM}"/>`;

const BODY = `<ellipse cx="16" cy="27.5" rx="8" ry="4.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.2"/><ellipse cx="16" cy="28.4" rx="4.2" ry="3" fill="${CREAM}"/><ellipse cx="7.6" cy="24.5" rx="2.6" ry="3.4" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/><ellipse cx="24.4" cy="24.5" rx="2.6" ry="3.4" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1"/>`;

const HEAD = `<circle cx="16" cy="14" r="10.5" fill="${FUR}" stroke="${FUR_DARK}" stroke-width="1.2"/>`;

const MUZZLE = `<ellipse cx="16" cy="18.6" rx="5" ry="3.8" fill="${CREAM}"/><ellipse cx="16" cy="16.9" rx="1.7" ry="1.2" fill="${NOSE}"/><path d="M16 18 Q16 19.5 14.5 19.7" fill="none" stroke="${NOSE}" stroke-width="0.7" stroke-linecap="round"/><path d="M16 18 Q16 19.5 17.5 19.7" fill="none" stroke="${NOSE}" stroke-width="0.7" stroke-linecap="round"/>`;

const CHEEKS = "<circle cx=\"9\" cy=\"16.6\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.55\"/><circle cx=\"23\" cy=\"16.6\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.55\"/>";

const TEDDY = EARS + BODY + HEAD + MUZZLE + CHEEKS;

const uriCache = new Map<string, string>();

function toUri(inner: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${inner}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildTeddyUri({ expression, accessory }: { expression: GhostExpression; accessory: string | null; }): string {
    const key = `${expression}|${accessory ?? ""}`;
    const cached = uriCache.get(key);
    if (cached) return cached;
    const acc = accessory && GHOST_ACCESSORIES[accessory] ? GHOST_ACCESSORIES[accessory].svg : "";
    const uri = toUri(TEDDY + eyesFor(expression) + acc);
    uriCache.set(key, uri);
    return uri;
}
