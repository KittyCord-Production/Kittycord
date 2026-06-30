/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;
let tracking = false;

function onMove(e: MouseEvent) {
    cursorX = e.clientX;
    cursorY = e.clientY;
}

export function startCursorTracking() {
    if (tracking) return;
    tracking = true;
    document.addEventListener("mousemove", onMove, { passive: true });
}

export function stopCursorTracking() {
    if (!tracking) return;
    tracking = false;
    document.removeEventListener("mousemove", onMove);
}

export function getCursor() {
    return { x: cursorX, y: cursorY };
}
