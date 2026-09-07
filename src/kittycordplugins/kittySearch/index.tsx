/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { toggleSearch } from "./SearchModal";

interface Hotkey {
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    key: string;
    label: string;
}

const HOTKEYS = {
    "ctrl-shift-k": { ctrl: true, shift: true, alt: false, key: "k", label: "Ctrl / Cmd + Shift + K" },
    "ctrl-shift-p": { ctrl: true, shift: true, alt: false, key: "p", label: "Ctrl / Cmd + Shift + P" },
    "alt-k": { ctrl: false, shift: false, alt: true, key: "k", label: "Alt + K" }
} satisfies Record<string, Hotkey>;

type HotkeyId = keyof typeof HOTKEYS;

const settings = definePluginSettings({
    hotkey: {
        type: OptionType.SELECT,
        description: "The shortcut that opens Kitty Search",
        options: Object.entries(HOTKEYS).map(([value, h], i) => ({ label: h.label, value, default: i === 0 }))
    }
});

function matches(e: KeyboardEvent): boolean {
    const h: Hotkey = HOTKEYS[settings.store.hotkey as HotkeyId] ?? HOTKEYS["ctrl-shift-k"];
    return e.key.toLowerCase() === h.key
        && (e.ctrlKey || e.metaKey) === h.ctrl
        && e.shiftKey === h.shift
        && e.altKey === h.alt;
}

function onKey(e: KeyboardEvent) {
    if (!matches(e)) return;
    e.preventDefault();
    e.stopPropagation();
    toggleSearch();
}

export default definePlugin({
    name: "KittySearch",
    description: "Find any Kittycord setting, plugin or action and jump straight to it. Open it with a keyboard shortcut (Ctrl/Cmd+Shift+K by default).",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,
    settings,

    start() {
        window.addEventListener("keydown", onKey, true);
    },

    stop() {
        window.removeEventListener("keydown", onKey, true);
    }
});
