/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

// Discord renders the "Kittycord Settings" heading from a plain string, so we
// can't style it directly. Instead we tag the rendered text node and let CSS
// run a black-and-white shimmer with a glint sweeping left-to-right.

const STYLE_ID = "kittycord-settings-glint";
const CLASS = "kittycord-glint-title";
const TARGET_TEXT = "Kittycord Settings";
const SCAN_INTERVAL_MS = 1000;

const CSS = `
@keyframes kittycord-glint-sweep {
    0%   { background-position: -50% center; }
    100% { background-position: 150% center; }
}
.${CLASS} {
    background-image: linear-gradient(
        100deg,
        #6e6e6e 0%,
        #6e6e6e 35%,
        #ffffff 50%,
        #6e6e6e 65%,
        #6e6e6e 100%
    );
    background-size: 250% auto;
    background-repeat: no-repeat;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent !important;
    animation: kittycord-glint-sweep 3.5s linear infinite !important;
    animation-play-state: running !important;
}
`;

const CANDIDATE_SELECTOR = 'h1,h2,h3,[class*="title"],[class*="header"],[class*="eyebrow"]';

function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head ?? document.documentElement).appendChild(style);
}

function scan() {
    let matched = false;

    const candidates = document.querySelectorAll<HTMLElement>(CANDIDATE_SELECTOR);
    for (const el of candidates) {
        if (el.classList.contains(CLASS)) continue;
        if (el.childElementCount !== 0) continue;
        if (el.textContent?.trim() === TARGET_TEXT) {
            el.classList.add(CLASS);
            matched = true;
        }
    }
    return matched;
}

let scanTimer: ReturnType<typeof setInterval> | null = null;

export default definePlugin({
    name: "SettingsGlint",
    enabledByDefault: false,
    description: "Animates the 'Kittycord Settings' heading with a black-and-white left-to-right glint.",
    authors: [{ name: "Kittycord", id: 0n }],

    start() {
        if (typeof window === "undefined") return;

        injectStyle();
        scan();

        // Settings mount later — light polling only. No body MutationObserver (startup freeze).
        scanTimer = setInterval(() => {
            injectStyle();
            scan();
        }, SCAN_INTERVAL_MS);
    },

    stop() {
        if (scanTimer) clearInterval(scanTimer);
        scanTimer = null;
        document.getElementById(STYLE_ID)?.remove();
        document.querySelectorAll("." + CLASS).forEach(el => el.classList.remove(CLASS));
    }
});
