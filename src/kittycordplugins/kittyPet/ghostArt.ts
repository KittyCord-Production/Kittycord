/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type GhostExpression = "idle" | "blink" | "happy" | "alert" | "sleep";

const EYE = "#3a2230";

const BODY = "<path d=\"M6 16 C6 8 11 4 16 4 C21 4 26 8 26 16 L26 24 Q23.5 29 21 24 Q18.5 29 16 24 Q13.5 29 11 24 Q8.5 29 6 24 Z\" fill=\"#ffe9f4\" fill-opacity=\"0.94\" stroke=\"#ff8ac4\" stroke-width=\"1.2\"/>";

const CHEEKS = "<circle cx=\"9.5\" cy=\"18\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.5\"/><circle cx=\"22.5\" cy=\"18\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.5\"/>";

function eyesFor(expression: GhostExpression): string {
    switch (expression) {
        case "blink":
            return `<rect x="10.8" y="14.4" width="3.4" height="1.5" rx="0.7" fill="${EYE}"/><rect x="17.8" y="14.4" width="3.4" height="1.5" rx="0.7" fill="${EYE}"/>`;
        case "happy":
            return `<path d="M10.8 15.4 L12.5 13.2 L14.2 15.4" fill="none" stroke="${EYE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.8 15.4 L19.5 13.2 L21.2 15.4" fill="none" stroke="${EYE}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
        case "alert":
            return `<ellipse cx="12.5" cy="14.6" rx="2.4" ry="3.1" fill="${EYE}"/><ellipse cx="19.5" cy="14.6" rx="2.4" ry="3.1" fill="${EYE}"/><circle cx="13.4" cy="13.6" r="0.8" fill="#ffe9f4"/><circle cx="20.4" cy="13.6" r="0.8" fill="#ffe9f4"/><ellipse cx="16" cy="20.2" rx="1.5" ry="1.9" fill="${EYE}"/>`;
        case "sleep":
            return `<path d="M10.6 15 Q12.5 17.2 14.4 15" fill="none" stroke="${EYE}" stroke-width="1.4" stroke-linecap="round"/><path d="M17.6 15 Q19.5 17.2 21.4 15" fill="none" stroke="${EYE}" stroke-width="1.4" stroke-linecap="round"/>`;
        default:
            return `<ellipse cx="12.5" cy="15" rx="2" ry="2.7" fill="${EYE}"/><ellipse cx="19.5" cy="15" rx="2" ry="2.7" fill="${EYE}"/><circle cx="13.3" cy="14.1" r="0.7" fill="#ffe9f4"/><circle cx="20.3" cy="14.1" r="0.7" fill="#ffe9f4"/>`;
    }
}

export const GHOST_ACCESSORIES: Record<string, { label: string; svg: string; }> = {
    halo: {
        label: "Halo",
        svg: "<ellipse cx=\"16\" cy=\"2.6\" rx=\"6\" ry=\"1.8\" fill=\"none\" stroke=\"#ffd46b\" stroke-width=\"1.5\"/>"
    },
    witchHat: {
        label: "Witch hat",
        svg: "<ellipse cx=\"16\" cy=\"6\" rx=\"9.5\" ry=\"2.1\" fill=\"#5b3a7a\"/><path d=\"M16 0.5 L21.5 6 L10.5 6 Z\" fill=\"#6d479a\"/><rect x=\"11\" y=\"4.6\" width=\"10\" height=\"1.6\" fill=\"#ffd46b\"/>"
    },
    scarf: {
        label: "Cozy scarf",
        svg: "<path d=\"M7 21 Q16 24.5 25 21 L25 23.5 Q16 27 7 23.5 Z\" fill=\"#8ad1ff\"/><rect x=\"13\" y=\"22.5\" width=\"3\" height=\"5.5\" rx=\"0.6\" fill=\"#8ad1ff\"/>"
    },
    crown: {
        label: "Spooky crown",
        svg: "<path d=\"M10 8 L10 3 L13 5.5 L16 2 L19 5.5 L22 3 L22 8 Z\" fill=\"#b07bd8\" stroke=\"#8a55b8\" stroke-width=\"0.5\"/><circle cx=\"16\" cy=\"2\" r=\"0.9\" fill=\"#ff8ac4\"/>"
    }
};

export const GHOST_ACCESSORY_LEVELS: Record<string, number> = {
    halo: 2,
    witchHat: 3,
    scarf: 4,
    crown: 5
};

const THUMB_VIEWBOX: Record<string, string> = {
    halo: "4 0 24 6",
    witchHat: "6 0 20 8",
    scarf: "6 20 20 9",
    crown: "9 1 14 8"
};

function toUri(viewBox: string, inner: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const uriCache = new Map<string, string>();

export function buildGhostUri({ expression, accessory }: { expression: GhostExpression; accessory: string | null; }): string {
    const key = `${expression}|${accessory ?? ""}`;
    const cached = uriCache.get(key);
    if (cached) return cached;
    const acc = accessory && GHOST_ACCESSORIES[accessory] ? GHOST_ACCESSORIES[accessory].svg : "";
    const uri = toUri("0 0 32 32", BODY + CHEEKS + eyesFor(expression) + acc);
    uriCache.set(key, uri);
    return uri;
}

export const GHOST_ACCESSORY_THUMBS: Record<string, string> = Object.fromEntries(
    Object.entries(GHOST_ACCESSORIES).map(([id, a]) => [id, toUri(THUMB_VIEWBOX[id], a.svg)])
);
