/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { CommandList } from "./CommandList";

export interface CustomCommand {
    trigger: string;
    message: string;
    mode: "send" | "insert";
}

export const settings = definePluginSettings({
    prefix: {
        type: OptionType.STRING,
        description: "Prefix that starts a command.",
        default: "."
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

export function addCommand(command: CustomCommand) {
    settings.store.commands[command.trigger.toLowerCase()] = command;
}

export function removeCommand(trigger: string) {
    delete settings.store.commands[trigger.toLowerCase()];
}

const SHARE_PREFIX = "KCMD1:";

export function exportCommands(commands: CustomCommand[]): string {
    return SHARE_PREFIX + btoa(encodeURIComponent(JSON.stringify(commands)));
}

export function sanitizeCommands(data: unknown): CustomCommand[] {
    if (!Array.isArray(data)) return [];

    const out: CustomCommand[] = [];
    for (const c of data) {
        if (!c || typeof c !== "object") continue;
        const trigger = typeof c.trigger === "string" ? c.trigger.trim() : "";
        const message = typeof c.message === "string" ? c.message : "";
        if (!trigger || /\s/.test(trigger) || !message) continue;
        out.push({ trigger, message, mode: c.mode === "insert" ? "insert" : "send" });
    }
    return out;
}

export function importCommands(code: string): CustomCommand[] | null {
    const trimmed = code.trim();
    if (!trimmed.startsWith(SHARE_PREFIX)) return null;
    try {
        const out = sanitizeCommands(JSON.parse(decodeURIComponent(atob(trimmed.slice(SHARE_PREFIX.length)))));
        return out.length ? out : null;
    } catch {
        return null;
    }
}
