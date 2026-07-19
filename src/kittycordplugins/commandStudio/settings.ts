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
