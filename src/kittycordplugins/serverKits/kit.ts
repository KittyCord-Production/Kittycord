/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { escapeRegExp } from "@utils/text";

import { BRAND_WEBSITE } from "../../branding";
import { CustomCommand, sanitizeCommands } from "../commandStudio/settings";
import { sanitizeParams, StudioParams } from "../kittycordStudio/template";

export const KIT_LINK_RE = new RegExp(`${escapeRegExp(BRAND_WEBSITE)}/k/\\?id=([0-9a-f-]{36})`, "i");
export const MAX_SOUNDS = 20;
export const MAX_PLUGINS = 40;

export interface KitSound {
    scope: "user" | "channel" | "guild";
    targetId: string;
    sound: string;
}

export interface ServerKit {
    v: 1;
    id?: string;
    name: string;
    guildName?: string;
    theme?: StudioParams;
    commands?: CustomCommand[];
    sounds?: KitSound[];
    plugins?: string[];
}

const NAME_RE = /^[\w\-'!&. ]{1,60}$/;
const SNOWFLAKE_RE = /^\d{17,20}$/;
const SOUND_RE = /^[\w-]{1,64}$/;

export function kitLink(id: string) {
    return `${BRAND_WEBSITE}/k/?id=${id}`;
}

export function findKitLink(text: string): string | null {
    return KIT_LINK_RE.exec(text)?.[1] ?? null;
}

export function importablePlugin(name: string) {
    const plugin = plugins[name];
    return Boolean(plugin) && !plugin.required && !name.endsWith("API");
}

export function sanitizeKit(raw: unknown): ServerKit | null {
    if (!raw || typeof raw !== "object") return null;

    const data = raw as Record<string, unknown>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    if (!NAME_RE.test(name)) return null;

    const kit: ServerKit = { v: 1, name };

    if (typeof data.id === "string") kit.id = data.id;
    if (typeof data.guildName === "string" && data.guildName.trim())
        kit.guildName = data.guildName.trim().slice(0, 100);

    if (data.theme) {
        try {
            kit.theme = sanitizeParams(data.theme);
        } catch {
            delete kit.theme;
        }
    }

    const commands = sanitizeCommands(data.commands);
    if (commands.length) kit.commands = commands;

    if (Array.isArray(data.sounds)) {
        const sounds: KitSound[] = [];
        for (const entry of data.sounds.slice(0, MAX_SOUNDS)) {
            if (!entry || typeof entry !== "object") continue;
            const { scope, targetId, sound } = entry as Record<string, unknown>;
            if (scope !== "user" && scope !== "channel" && scope !== "guild") continue;
            if (typeof targetId !== "string" || !SNOWFLAKE_RE.test(targetId)) continue;
            if (typeof sound !== "string" || !SOUND_RE.test(sound)) continue;
            sounds.push({ scope, targetId, sound });
        }
        if (sounds.length) kit.sounds = sounds;
    }

    if (Array.isArray(data.plugins)) {
        const names = data.plugins
            .filter((p): p is string => typeof p === "string")
            .filter(importablePlugin)
            .slice(0, MAX_PLUGINS);
        if (names.length) kit.plugins = names;
    }

    if (!kit.theme && !kit.commands && !kit.sounds && !kit.plugins) return null;

    return kit;
}

export function kitSummary(kit: ServerKit): string {
    const parts: string[] = [];
    if (kit.theme) parts.push("a theme");
    if (kit.commands?.length) parts.push(`${kit.commands.length} command${kit.commands.length === 1 ? "" : "s"}`);
    if (kit.sounds?.length) parts.push(`${kit.sounds.length} sound rule${kit.sounds.length === 1 ? "" : "s"}`);
    if (kit.plugins?.length) parts.push(`${kit.plugins.length} plugin${kit.plugins.length === 1 ? "" : "s"}`);

    if (parts.length <= 1) return parts[0] ?? "nothing";
    return `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}
