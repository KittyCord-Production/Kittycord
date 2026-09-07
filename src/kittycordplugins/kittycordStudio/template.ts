/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_API } from "../../branding";

export interface StudioColors {
    bg: string;
    accent: string;
    accentHi: string;
    text: string;
    muted: string;
    accent2?: string;
    accent3?: string;
}

export type StudioBgKind = "none" | "hosted" | "url";

export interface StudioBg {
    kind: StudioBgKind;
    id?: string;
    url?: string;
}

export interface StudioParams {
    v: 1;
    name: string;
    colors: StudioColors;
    roundness: number;
    sparkles: boolean;
    bg: StudioBg;
    pattern: string;
    font: string;
    opacity: number;
    blur: number;
}

export const HEX_RE = /^#[0-9a-f]{6}$/i;
export const NAME_RE = /^[\w\-'!&. ]{1,40}$/;
export const MAX_ROUNDNESS = 24;
export const MAX_BLUR = 24;
export const MAX_BG_URL_LEN = 300;
export const BG_URL_RE = /^https:\/\/[^\s"'<>]+$/i;

export const ASSET_ENDPOINT = BRAND_API;

export const BG_IDS: readonly string[] = ["petals", "aurora", "grid", "stars", "nebula", "dawn"];
export const PATTERN_IDS: readonly string[] = ["dots", "diagonal", "hearts", "paws", "lattice"];

export interface FontChoice {
    label: string;
    family: string;
    stack: string;
}

export const FONTS: Record<string, FontChoice> = {
    jersey: { label: "Jersey", family: "KC Jersey", stack: "'KC Jersey', 'gg sans', sans-serif" },
    nunito: { label: "Nunito", family: "KC Nunito", stack: "'KC Nunito', 'gg sans', sans-serif" },
    quicksand: { label: "Quicksand", family: "KC Quicksand", stack: "'KC Quicksand', 'gg sans', sans-serif" },
    comfortaa: { label: "Comfortaa", family: "KC Comfortaa", stack: "'KC Comfortaa', 'gg sans', sans-serif" },
    baloo: { label: "Baloo", family: "KC Baloo", stack: "'KC Baloo', 'gg sans', sans-serif" }
};
export const FONT_IDS: readonly string[] = Object.keys(FONTS);

export const bgAssetUrl = (id: string) => `${ASSET_ENDPOINT}/bg/assets/${id}`;
export const patternAssetUrl = (id: string) => `${ASSET_ENDPOINT}/pattern/assets/${id}`;
export const fontAssetUrl = (id: string) => `${ASSET_ENDPOINT}/fonts/${id}.woff2`;

const MARKER_RE = /\/\* kc-studio:([A-Za-z0-9+/=]+) \*\//;

export function defaultParams(): StudioParams {
    return {
        v: 1,
        name: "My Theme",
        colors: {
            bg: "#110a0e",
            accent: "#ff5fa6",
            accentHi: "#ff8ac4",
            text: "#f3e6ee",
            muted: "#9a7389"
        },
        roundness: 14,
        sparkles: true,
        bg: { kind: "none" },
        pattern: "",
        font: "",
        opacity: 78,
        blur: 0
    };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
}

function migrateGlass(raw: any): { opacity: number; blur: number; } {
    const hasOpacity = raw.opacity !== undefined && raw.opacity !== null;
    const hasBlur = raw.blur !== undefined && raw.blur !== null;
    if (!hasOpacity && !hasBlur && raw.glass !== undefined)
        return { opacity: raw.glass ? 78 : 100, blur: 0 };
    return { opacity: clampInt(raw.opacity, 0, 100, 100), blur: clampInt(raw.blur, 0, MAX_BLUR, 0) };
}

function sanitizeBg(raw: any): StudioBg {
    if (!raw || typeof raw !== "object") return { kind: "none" };
    if (raw.kind === "hosted" && BG_IDS.includes(String(raw.id))) return { kind: "hosted", id: String(raw.id) };
    if (raw.kind === "url") {
        const url = String(raw.url ?? "");
        if (url.startsWith("/img?url=") && url.length <= 1000) return { kind: "url", url };
        if (url.length <= MAX_BG_URL_LEN && BG_URL_RE.test(url)) return { kind: "url", url };
    }
    return { kind: "none" };
}

export function sanitizeParams(raw: any): StudioParams {
    if (!raw || typeof raw !== "object" || !raw.colors || typeof raw.colors !== "object")
        throw new Error("That is not a valid Studio theme.");

    const colors: StudioColors = { bg: "", accent: "", accentHi: "", text: "", muted: "" };
    for (const key of ["bg", "accent", "accentHi", "text", "muted"] as const) {
        const value = String(raw.colors[key] ?? "").toLowerCase();
        if (!HEX_RE.test(value)) throw new Error("That is not a valid Studio theme.");
        colors[key] = value;
    }
    for (const key of ["accent2", "accent3"] as const) {
        const value = String(raw.colors[key] ?? "").toLowerCase();
        if (value && HEX_RE.test(value)) colors[key] = value;
    }

    const name = String(raw.name ?? "").trim().slice(0, 40);
    if (!NAME_RE.test(name)) throw new Error("That theme has an invalid name.");

    const roundness = Math.round(Number(raw.roundness));
    if (!Number.isFinite(roundness) || roundness < 0 || roundness > MAX_ROUNDNESS)
        throw new Error("That is not a valid Studio theme.");

    const { opacity, blur } = migrateGlass(raw);

    return {
        v: 1,
        name,
        colors,
        roundness,
        sparkles: Boolean(raw.sparkles),
        bg: sanitizeBg(raw.bg),
        pattern: PATTERN_IDS.includes(String(raw.pattern)) ? String(raw.pattern) : "",
        font: FONT_IDS.includes(String(raw.font)) ? String(raw.font) : "",
        opacity,
        blur
    };
}

function hexToHsl(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h: number;
    switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4;
    }
    return [h * 60, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
    s = Math.min(100, Math.max(0, s)) / 100;
    l = Math.min(98, Math.max(0, l)) / 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function shiftLightness(hex: string, delta: number): string {
    const [h, s, l] = hexToHsl(hex);
    return hslToHex(h, s, l + delta);
}

function hexToRgbTriplet(hex: string): string {
    return `${parseInt(hex.slice(1, 3), 16)} ${parseInt(hex.slice(3, 5), 16)} ${parseInt(hex.slice(5, 7), 16)}`;
}

export interface DerivedPalette {
    bg: string[];
    line: string;
    surfaceHighest: string;
    accent: string;
    accentHi: string;
    accent2: string;
    accent3: string;
    accentStrong: string;
    accentDeep: string;
    text: string;
    muted: string;
    blush: string;
}

export function derivePalette(params: StudioParams): DerivedPalette {
    const { bg, accent, accentHi, accent2, accent3, text, muted } = params.colors;
    return {
        bg: [-1, 0, 3, 5, 8, 11].map(d => shiftLightness(bg, d)),
        line: shiftLightness(bg, 14),
        surfaceHighest: shiftLightness(bg, 17),
        accent,
        accentHi,
        accent2: accent2 || accent,
        accent3: accent3 || accentHi,
        accentStrong: shiftLightness(accent, -4),
        accentDeep: shiftLightness(accent, -9),
        text,
        muted,
        blush: shiftLightness(muted, 14)
    };
}

function resolveBgUrl(url: string): string {
    if (!url) return "";
    return url.startsWith("/") ? ASSET_ENDPOINT + url : url;
}

function appMountBackdrop(p: DerivedPalette, bg1: string, params: StudioParams): string {
    const layers: string[] = [];

    if (params.sparkles) {
        const a = encodeURIComponent(p.accent);
        const hi = encodeURIComponent(p.accentHi);
        const accentRgb = hexToRgbTriplet(p.accent);
        const hiRgb = hexToRgbTriplet(p.accentHi);
        layers.push(
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'%3E%3Cg stroke='${a}' stroke-opacity='.32' stroke-width='.7'%3E%3Cpath d='M100 8 192 100 100 192 8 100Z'/%3E%3Cpath d='M100 30 170 100 100 170 30 100Z' stroke-dasharray='3 4' stroke-opacity='.55'/%3E%3C/g%3E%3Cg stroke='${hi}' stroke-opacity='.22' stroke-width='.6'%3E%3Ccircle cx='170' cy='30' r='92'/%3E%3Ccircle cx='170' cy='30' r='76' stroke-dasharray='2 5'/%3E%3C/g%3E%3Cg stroke='${hi}' stroke-opacity='.6' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M28 44h12M34 38v12'/%3E%3Cpath d='M58 132h9M62.5 127.5v9'/%3E%3Cpath d='M148 152h9M152.5 147.5v9'/%3E%3C/g%3E%3C/svg%3E") no-repeat right -140px top -160px / 640px 640px`,
            `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' fill='none'%3E%3Cg stroke='${hi}' stroke-width='.7'%3E%3Ccircle cx='100' cy='100' r='88' stroke-opacity='.30' stroke-dasharray='3 5'/%3E%3Ccircle cx='100' cy='100' r='62' stroke-opacity='.18'/%3E%3C/g%3E%3Cg stroke='${hi}' stroke-opacity='.5' stroke-width='2.2' stroke-linecap='round'%3E%3Cpath d='M150 60h10M155 55v10'/%3E%3C/g%3E%3C/svg%3E") no-repeat left -200px bottom -220px / 560px 560px`,
            `radial-gradient(1000px 620px at 10% -12%, rgb(${accentRgb} / 13%), transparent 62%)`,
            `radial-gradient(880px 700px at 98% 34%, rgb(${hiRgb} / 9%), transparent 58%)`
        );
    }

    if (params.pattern)
        layers.push(`url("${patternAssetUrl(params.pattern)}") repeat`);

    if (params.bg.kind !== "none") {
        const url = params.bg.kind === "hosted" ? bgAssetUrl(params.bg.id ?? "") : resolveBgUrl(params.bg.url ?? "");
        if (url) layers.push(`url("${url}") no-repeat center / cover fixed`);
    }

    if (!layers.length) return "";

    layers.push(bg1);
    return `#app-mount {
    background: ${layers.join(",\n        ")};
}

#app-mount [class*="bg_"] {
    background: transparent;
}`;
}

function fontFaceCss(id: string): string {
    const f = FONTS[id];
    if (!f) return "";
    return `@font-face {
    font-family: "${f.family}";
    src: url("${fontAssetUrl(id)}") format("woff2");
    font-display: swap;
}

:root {
    --font-primary: ${f.stack};
    --font-display: ${f.stack};
}
`;
}

function blurCss(blur: number): string {
    if (blur <= 0) return "";
    return `[class*="chatContent"],
[class*="messagesWrapper"],
[class*="sidebar_"],
[class*="guilds_"] {
    backdrop-filter: blur(${blur}px);
}

[class*="menu_"],
[class*="layerContainer"],
[class*="popout"],
[role="menu"] {
    backdrop-filter: none !important;
}`;
}

function perfFallback(bg0: string, bg1: string, bg2: string, bg3: string): string {
    const opaque = `--background-primary: ${bg3};
        --background-secondary: ${bg2};
        --background-secondary-alt: ${bg2};
        --background-tertiary: ${bg1};
        --background-base-lowest: ${bg0};
        --background-base-lower: ${bg1};
        --background-base-low: ${bg2};
        --bg-overlay-chat: ${bg3};
        --bg-base-primary: ${bg3};
        --bg-base-secondary: ${bg2};
        --bg-base-tertiary: ${bg1};`;
    return `@media (prefers-reduced-transparency: reduce) {
    .theme-dark,
    .theme-darker,
    .theme-midnight,
    .visual-refresh.theme-dark,
    .visual-refresh .theme-dark {
        ${opaque}
    }

    #app-mount { background: ${bg1}; }
    [class*="chatContent"], [class*="messagesWrapper"], [class*="sidebar_"], [class*="guilds_"] { backdrop-filter: none; }
}

html.kc-perf-noblur .theme-dark,
html.kc-perf-noblur .theme-darker,
html.kc-perf-noblur .theme-midnight,
html.kc-perf-noblur .visual-refresh.theme-dark,
html.kc-perf-noblur .visual-refresh .theme-dark,
html.kc-idle-noblur .theme-dark,
html.kc-idle-noblur .theme-darker,
html.kc-idle-noblur .theme-midnight,
html.kc-idle-noblur .visual-refresh.theme-dark,
html.kc-idle-noblur .visual-refresh .theme-dark {
        ${opaque}
}

html.kc-perf-noblur #app-mount,
html.kc-idle-noblur #app-mount { background: ${bg1}; }
html.kc-perf-noblur [class*="chatContent"],
html.kc-perf-noblur [class*="messagesWrapper"],
html.kc-perf-noblur [class*="sidebar_"],
html.kc-perf-noblur [class*="guilds_"],
html.kc-idle-noblur [class*="chatContent"],
html.kc-idle-noblur [class*="messagesWrapper"],
html.kc-idle-noblur [class*="sidebar_"],
html.kc-idle-noblur [class*="guilds_"] { backdrop-filter: none; }`;
}

export function encodeMarker(params: StudioParams): string {
    return `/* kc-studio:${btoa(encodeURIComponent(JSON.stringify(params)))} */`;
}

export function decodeMarker(css: string): StudioParams | null {
    const match = css.match(MARKER_RE);
    if (!match) return null;
    try {
        return sanitizeParams(JSON.parse(decodeURIComponent(atob(match[1]))));
    } catch {
        return null;
    }
}

export function themeFileName(params: StudioParams): string {
    return `Kittycord Studio - ${params.name}.theme.css`;
}

export function generateCss(params: StudioParams): string {
    const p = derivePalette(params);
    const [bg0, bg1, bg2, bg3, bg4, bg5] = p.bg;
    const r = params.roundness;
    const embedRadius = Math.max(4, r - 2);

    const accentRgb = hexToRgbTriplet(p.accent);
    const accentHiRgb = hexToRgbTriplet(p.accentHi);
    const bg0Rgb = hexToRgbTriplet(bg0);
    const bg1Rgb = hexToRgbTriplet(bg1);
    const bg2Rgb = hexToRgbTriplet(bg2);
    const bg3Rgb = hexToRgbTriplet(bg3);

    const opacity = clampInt(params.opacity, 0, 100, 78);
    const blur = clampInt(params.blur, 0, MAX_BLUR, 0);
    const surface = (rgb: string, alpha: number, solid: string) =>
        opacity >= 100 ? solid : `rgb(${rgb} / ${Math.round(alpha * opacity / 78)}%)`;

    const primary = surface(bg3Rgb, 78, bg3);
    const secondary = surface(bg2Rgb, 72, bg2);
    const tertiary = surface(bg1Rgb, 60, bg1);
    const lowest = surface(bg0Rgb, 55, bg0);

    return `/**
 * @name ${params.name}
 * @author Kittycord Studio
 * @description Made with Kittycord Studio — colors, roundness and sparkles, no CSS needed.
 * @version 1.0.0
 * @website https://kittycord.dev
*/

${encodeMarker(params)}

${fontFaceCss(params.font)}:root {
    --kc-bg-0: ${bg0};
    --kc-bg-1: ${bg1};
    --kc-bg-2: ${bg2};
    --kc-bg-3: ${bg3};
    --kc-bg-4: ${bg4};
    --kc-bg-5: ${bg5};
    --kc-line: ${p.line};
    --kc-pink: ${p.accent};
    --kc-pink-strong: ${p.accentStrong};
    --kc-pink-hi: ${p.accentHi};
    --kc-accent-2: ${p.accent2};
    --kc-accent-3: ${p.accent3};
    --kc-blush: ${p.blush};
    --kc-faint: ${p.muted};
}

.theme-dark,
.theme-darker,
.theme-midnight,
.visual-refresh.theme-dark,
.visual-refresh .theme-dark {
    --background-primary: ${primary};
    --background-secondary: ${secondary};
    --background-secondary-alt: ${secondary};
    --background-tertiary: ${tertiary};
    --background-floating: var(--kc-bg-2);
    --background-nested-floating: var(--kc-bg-2);
    --background-mobile-primary: var(--kc-bg-3);
    --background-mobile-secondary: var(--kc-bg-2);
    --background-accent: var(--kc-bg-5);
    --background-modifier-hover: rgb(${accentRgb} / 7%);
    --background-modifier-active: rgb(${accentRgb} / 10%);
    --background-modifier-selected: rgb(${accentRgb} / 13%);
    --background-modifier-accent: var(--kc-line);
    --channeltextarea-background: var(--kc-bg-4);
    --modal-background: var(--kc-bg-2);
    --modal-footer-background: var(--kc-bg-1);
    --activity-card-background: var(--kc-bg-2);
    --background-message-hover: rgb(${accentRgb} / 4%);
    --background-message-highlight: rgb(${accentHiRgb} / 9%);

    --background-base-lowest: ${lowest};
    --background-base-lower: ${tertiary};
    --background-base-low: ${secondary};
    --background-surface-high: var(--kc-bg-4);
    --background-surface-higher: var(--kc-bg-5);
    --background-surface-highest: ${p.surfaceHighest};
    --bg-overlay-chat: ${primary};
    --bg-base-primary: ${primary};
    --bg-base-secondary: ${secondary};
    --bg-base-tertiary: ${tertiary};
    --bg-surface-raised: var(--kc-bg-2);
    --bg-surface-overlay: var(--kc-bg-2);
    --border-subtle: var(--kc-line);
    --border-faint: rgb(${hexToRgbTriplet(p.line)} / 60%);

    --header-primary: ${p.text};
    --header-secondary: var(--kc-blush);
    --text-normal: ${p.text};
    --text-muted: var(--kc-faint);
    --text-link: var(--kc-accent-3);
    --channels-default: var(--kc-faint);
    --channel-icon: var(--kc-faint);
    --interactive-normal: var(--kc-blush);
    --interactive-hover: ${p.text};
    --interactive-active: ${p.text};
    --interactive-muted: ${shiftLightness(params.colors.muted, -18)};

    --brand-experiment: var(--kc-pink);
    --brand-experiment-360: var(--kc-pink-hi);
    --brand-experiment-500: var(--kc-pink);
    --brand-experiment-560: var(--kc-pink-strong);
    --brand-experiment-600: ${p.accentDeep};
    --brand-260: ${shiftLightness(params.colors.accentHi, 12)};
    --brand-360: var(--kc-pink-hi);
    --brand-500: var(--kc-pink);
    --brand-560: var(--kc-pink-strong);
    --brand-600: ${p.accentDeep};
    --mention-foreground: var(--kc-pink-hi);
    --mention-background: rgb(${accentRgb} / 14%);
    --info-help-foreground: var(--kc-pink-hi);
    --control-brand-foreground: var(--kc-pink);
    --control-brand-foreground-new: var(--kc-pink);
    --focus-primary: var(--kc-pink);

    --scrollbar-auto-thumb: var(--kc-bg-5);
    --scrollbar-auto-track: transparent;
    --scrollbar-thin-thumb: var(--kc-bg-5);
    --scrollbar-thin-track: transparent;
    --scrollbar-auto-scrollbar-color-thumb: var(--kc-bg-5);
    --scrollbar-auto-scrollbar-color-track: transparent;
}

${appMountBackdrop(p, bg1, params)}

[class*="channelTextArea"] [class*="themedBackground"],
[class*="channelTextArea"] [class*="scrollableContainer"] {
    background: var(--kc-bg-4);
}

[class*="channelTextArea"] [class*="scrollableContainer"] {
    border: 1px solid var(--kc-line);
    border-radius: ${r}px;
}

[class*="containerDefault"] [class*="modeSelected"] [class*="link"],
[class*="containerDefault"] [class*="modeSelected"] [class*="name_"] {
    color: ${p.text};
}

[class*="sidebar"] [class*="unreadMentionsIndicator"] span,
span[class*="unread_"] {
    background: var(--kc-accent-2) !important;
}

[class*="embedFull"],
[class*="wrapper"][class*="standardEmbed"] {
    background: var(--kc-bg-2);
    border-color: var(--kc-line);
    border-radius: ${embedRadius}px;
}

[class*="codeContainer"] code,
code[class*="inline"] {
    background: var(--kc-bg-1);
    border-color: var(--kc-line);
}

[class*="tooltipPrimary"] {
    background-color: var(--kc-bg-5);
    color: ${p.text};
}

[class*="notice"][class*="colorDefault"] {
    background: var(--kc-bg-5);
}

${blurCss(blur)}

${perfFallback(bg0, bg1, bg2, bg3)}
`;
}
