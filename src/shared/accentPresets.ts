/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface AccentPreset {
    accent: string;
    soft: string;
    glow: string;
}

export const ACCENT_PRESETS = {
    pink: { accent: "#ff5fa6", soft: "#ff8ac4", glow: "255 95 166" },
    blue: { accent: "#5fa8ff", soft: "#8ac4ff", glow: "95 168 255" },
    purple: { accent: "#a06bff", soft: "#c4a8ff", glow: "160 107 255" },
    green: { accent: "#3ecf8e", soft: "#7ce3b3", glow: "62 207 142" },
    red: { accent: "#ff5f5f", soft: "#ff8a8a", glow: "255 95 95" },
    mono: { accent: "#b8bcc8", soft: "#d7dae2", glow: "184 188 200" }
} satisfies Record<string, AccentPreset>;

export type KittycordAccent = keyof typeof ACCENT_PRESETS;
