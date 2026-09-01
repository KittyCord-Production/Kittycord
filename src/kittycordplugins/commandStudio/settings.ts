/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { CommandList } from "./CommandList";

export type CommandScope =
    | { kind: "everywhere"; }
    | { kind: "dms"; }
    | { kind: "guilds"; guildIds: string[]; };

export interface CustomCommand {
    trigger: string;
    message: string;
    mode: "send" | "insert";
    description?: string;
    aliases?: string[];
    category?: string;
    scope?: CommandScope;
    attachments?: string[];
    slash?: boolean;
}

export const MAX_DESCRIPTION = 100;
export const MAX_ALIASES = 5;
export const MAX_CATEGORY = 30;
export const SLASH_NAME_RE = /^[-_a-z0-9]{1,32}$/;

export const settings = definePluginSettings({
    prefix: {
        type: OptionType.STRING,
        description: "Prefix that starts a command.",
        default: "."
    },
    slashCommands: {
        type: OptionType.BOOLEAN,
        description: "Also offer your commands in Discord's slash menu, so you can see what you have.",
        default: true
    },
    commands: {
        type: OptionType.CUSTOM,
        description: "",
        default: {} as Record<string, CustomCommand>
    },
    commandList: {
        type: OptionType.COMPONENT,
        component: CommandList
    }
});

export function getCommand(trigger: string) {
    return settings.store.commands[trigger.toLowerCase()];
}

export function resolveCommand(name: string): CustomCommand | undefined {
    const key = name.toLowerCase();
    const direct = settings.store.commands[key];
    if (direct) return direct;

    return Object.values(settings.store.commands)
        .find(c => c.aliases?.some(alias => alias.toLowerCase() === key));
}

export function addCommand(command: CustomCommand) {
    settings.store.commands = {
        ...settings.store.commands,
        [command.trigger.toLowerCase()]: command
    };
}

export function removeCommand(trigger: string) {
    const next = { ...settings.store.commands };
    delete next[trigger.toLowerCase()];
    settings.store.commands = next;
}

export function categories(): string[] {
    const seen = new Set<string>();
    for (const command of Object.values(settings.store.commands))
        if (command.category) seen.add(command.category);
    return [...seen].sort();
}

export function takenNames(except?: string): Set<string> {
    const taken = new Set<string>();
    for (const command of Object.values(settings.store.commands)) {
        if (except && command.trigger.toLowerCase() === except.toLowerCase()) continue;
        taken.add(command.trigger.toLowerCase());
        for (const alias of command.aliases ?? []) taken.add(alias.toLowerCase());
    }
    return taken;
}

const LEGACY_PREFIX = "KCMD1:";
const SHARE_PREFIX = "KCMD2:";

function shareable(command: CustomCommand): CustomCommand {
    const out: CustomCommand = {
        trigger: command.trigger,
        message: command.message,
        mode: command.mode
    };
    if (command.description) out.description = command.description;
    if (command.aliases?.length) out.aliases = command.aliases;
    if (command.category) out.category = command.category;
    return out;
}

export function exportCommands(commands: CustomCommand[]): string {
    const payload = JSON.stringify(commands.map(shareable));
    let binary = "";
    for (const byte of new TextEncoder().encode(payload)) binary += String.fromCharCode(byte);
    return SHARE_PREFIX + btoa(binary);
}

export function sanitizeCommands(data: unknown): CustomCommand[] {
    if (!Array.isArray(data)) return [];

    const out: CustomCommand[] = [];
    for (const c of data) {
        if (!c || typeof c !== "object") continue;
        const trigger = typeof c.trigger === "string" ? c.trigger.trim() : "";
        const message = typeof c.message === "string" ? c.message : "";
        if (!trigger || /\s/.test(trigger) || !message) continue;

        const command: CustomCommand = { trigger, message, mode: c.mode === "insert" ? "insert" : "send" };

        if (typeof c.description === "string" && c.description.trim())
            command.description = c.description.trim().slice(0, MAX_DESCRIPTION);

        if (Array.isArray(c.aliases)) {
            const aliases = c.aliases
                .filter((a: unknown): a is string => typeof a === "string" && Boolean(a.trim()) && !/\s/.test(a))
                .map((a: string) => a.trim())
                .slice(0, MAX_ALIASES);
            if (aliases.length) command.aliases = aliases;
        }

        if (typeof c.category === "string" && c.category.trim())
            command.category = c.category.trim().slice(0, MAX_CATEGORY);

        out.push(command);
    }
    return out;
}

export function importCommands(code: string): CustomCommand[] | null {
    const trimmed = code.trim();

    try {
        let json: string;
        if (trimmed.startsWith(SHARE_PREFIX)) {
            const binary = atob(trimmed.slice(SHARE_PREFIX.length));
            json = new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
        } else if (trimmed.startsWith(LEGACY_PREFIX)) {
            json = decodeURIComponent(atob(trimmed.slice(LEGACY_PREFIX.length)));
        } else {
            return null;
        }

        const out = sanitizeCommands(JSON.parse(json));
        return out.length ? out : null;
    } catch {
        return null;
    }
}
