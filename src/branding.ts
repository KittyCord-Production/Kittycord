/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * Central Kittycord branding.
 *
 * This file intentionally has NO imports so it can be used from any context (main, renderer,
 * preload, build) without risking circular dependencies. Reference these constants instead of
 * hardcoding the brand name, so the fork stays easy to merge with upstream Equicord/Vencord.
 */

export const BRAND_NAME = "Kittycord";
export const BRAND_NAME_LOWER = "kittycord";

/** Used to build user-agent strings, etc. */
export const BRAND_USER_AGENT_NAME = BRAND_NAME;

/**
 * The Kittycord cat mascot as an inline SVG. Exposed as a data URI so it can be used as an
 * <img src> (e.g. plugin badges) with no network request — `data:` URIs are allowed by the CSP,
 * so it can never be blocked or 404.
 */
const KITTY_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">' +
    '<rect width="512" height="512" rx="116" fill="#ff8ac4"/>' +
    '<path d="M150 196 L150 92 L244 168 Z" fill="#fff" stroke="#3a2230" stroke-width="10" stroke-linejoin="round"/>' +
    '<path d="M362 196 L362 92 L268 168 Z" fill="#fff" stroke="#3a2230" stroke-width="10" stroke-linejoin="round"/>' +
    '<ellipse cx="256" cy="280" rx="158" ry="138" fill="#fff" stroke="#3a2230" stroke-width="10"/>' +
    '<ellipse cx="200" cy="278" rx="17" ry="24" fill="#3a2230"/>' +
    '<ellipse cx="312" cy="278" rx="17" ry="24" fill="#3a2230"/>' +
    '<ellipse cx="256" cy="304" rx="11" ry="8" fill="#ffcf3f"/>' +
    '<g stroke="#3a2230" stroke-width="8" stroke-linecap="round">' +
    '<path d="M126 290 L74 276"/><path d="M126 310 L76 330"/>' +
    '<path d="M386 290 L438 276"/><path d="M386 310 L436 330"/></g>' +
    '<g transform="translate(330 150)">' +
    '<path d="M0 0 C-46 -34 -86 -30 -86 6 C-86 42 -46 44 0 12 Z" fill="#ff5fa2" stroke="#c61f63" stroke-width="8" stroke-linejoin="round"/>' +
    '<path d="M0 0 C46 -34 86 -30 86 6 C86 42 46 44 0 12 Z" fill="#ff5fa2" stroke="#c61f63" stroke-width="8" stroke-linejoin="round"/>' +
    '<circle cx="0" cy="6" r="17" fill="#ff7ab0" stroke="#c61f63" stroke-width="8"/></g></svg>';

export const BRAND_ICON = "data:image/svg+xml," + encodeURIComponent(KITTY_ICON_SVG);
