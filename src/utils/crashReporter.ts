/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const MAX_PER_SESSION = 5;
const MAX_MSG = 500;
const MAX_STACK_FRAMES = 10;

const seen = new Set<string>();
let sent = 0;

function scrub(text: string): string {
    return text
        .replace(/\d{17,20}/g, "<id>")
        .replace(/[\w-]{20,}\.[\w-]{6,}\.[\w-]{20,}/g, "<token>")
        .replace(/(?:[A-Za-z]:\\Users\\|\/(?:home|Users)\/)[^\\/\s"']+/gi, "<home>")
        .replace(/[^\s"'<>()]+@[^\s"'<>()]+\.[a-z]{2,}/gi, "<email>");
}

function hash(s: string): string {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = (h << 5) + h + s.charCodeAt(i) | 0;
    return String(h);
}

export function reportKittycordCrash(error: unknown, plugin?: string) {
    try {
        if (IS_DEV || IS_REPORTER || IS_WEB) return;
        if (sent >= MAX_PER_SESSION) return;
        if (typeof VencordNative === "undefined" || !VencordNative.kittycordCrash) return;

        const err = error instanceof Error ? error : new Error(String(error));
        const rawStack = err.stack ?? "";

        const key = hash((plugin ?? "") + (err.message || "") + rawStack.slice(0, 200));
        if (seen.has(key)) return;
        seen.add(key);

        const message = scrub(err.message || String(error)).slice(0, MAX_MSG);
        const stack = scrub(rawStack.split("\n").slice(0, MAX_STACK_FRAMES).join("\n"));

        sent++;
        VencordNative.kittycordCrash.report({ message, stack, plugin }).catch(() => { });
    } catch { /* crash reporting must never cause a crash */ }
}
