/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Accent {
    accent: string;
    soft: string;
    glow: string;
    hue: number;
}

const MIN_LIGHTNESS = 48;
const MAX_LIGHTNESS = 62;
const HUE_BUCKETS = 24;

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    const d = max - min;

    if (d === 0) return [0, 0, l * 100];

    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0));
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;

    return [h * 60, s * 100, l * 100];
}

export function hslToHex(h: number, s: number, l: number): string {
    const sn = s / 100, ln = l / 100;
    const c = (1 - Math.abs(2 * ln - 1)) * sn;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = ln - c / 2;

    const [r, g, b] =
        h < 60 ? [c, x, 0] :
            h < 120 ? [x, c, 0] :
                h < 180 ? [0, c, x] :
                    h < 240 ? [0, x, c] :
                        h < 300 ? [x, 0, c] : [c, 0, x];

    const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToTriplet(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export function extractAccent(pixels: Uint8ClampedArray): Accent | null {
    const weight = new Float64Array(HUE_BUCKETS);
    const satSum = new Float64Array(HUE_BUCKETS);
    const lightSum = new Float64Array(HUE_BUCKETS);
    const count = new Float64Array(HUE_BUCKETS);

    let considered = 0;

    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128) continue;

        const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
        if (s < 15 || l < 4 || l > 96) continue;

        const bucket = Math.min(HUE_BUCKETS - 1, Math.floor(h / (360 / HUE_BUCKETS)));
        weight[bucket] += s / 100;
        satSum[bucket] += s;
        lightSum[bucket] += l;
        count[bucket]++;
        considered++;
    }

    if (!considered) return null;

    let best = 0;
    for (let i = 1; i < HUE_BUCKETS; i++)
        if (weight[i] > weight[best]) best = i;

    if (!count[best]) return null;

    const hue = (best + 0.5) * (360 / HUE_BUCKETS);
    const saturation = Math.min(85, Math.max(45, satSum[best] / count[best]));
    const lightness = Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, lightSum[best] / count[best]));

    const accent = hslToHex(hue, saturation, lightness);

    return {
        accent,
        soft: hslToHex(hue, Math.max(35, saturation - 8), Math.min(78, lightness + 12)),
        glow: hexToTriplet(accent),
        hue
    };
}

export function mixAccent(from: Accent, to: Accent, t: number): Accent {
    let delta = to.hue - from.hue;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const hue = (from.hue + delta * t + 360) % 360;
    const [, fromS, fromL] = hexToHsl(from.accent);
    const [, toS, toL] = hexToHsl(to.accent);

    const s = fromS + (toS - fromS) * t;
    const l = fromL + (toL - fromL) * t;
    const accent = hslToHex(hue, s, l);

    return {
        accent,
        soft: hslToHex(hue, Math.max(35, s - 8), Math.min(78, l + 12)),
        glow: hexToTriplet(accent),
        hue
    };
}

export function hexToHsl(hex: string): [number, number, number] {
    const n = parseInt(hex.slice(1), 16);
    return rgbToHsl((n >> 16) & 255, (n >> 8) & 255, n & 255);
}
