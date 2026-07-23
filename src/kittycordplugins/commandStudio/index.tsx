/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { InlineCode } from "@components/CodeBlock";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { insertTextIntoChatInputBox } from "@utils/discord";
import definePlugin from "@utils/types";

import { openPackGallery, packsAvailable } from "./PackGallery";
import { getCommand, settings } from "./settings";

function resolvePlaceholders(template: string, args: string, channelId: string) {
    const now = new Date();
    const hadArgs = /\{(args|mentions)\}/i.test(template);

    let out = template.replaceAll("\\n", "\n").replace(/\{(args|mentions|channel|date|time)\}/gi, (_, key: string) => {
        switch (key.toLowerCase()) {
            case "args": return args;
            case "mentions": return (args.match(/\d{17,20}/g) ?? []).map(id => `<@${id}> - ${id}`).join("\n");
            case "channel": return `<#${channelId}>`;
            case "date": return now.toLocaleDateString();
            case "time": return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            default: return "";
        }
    });

    if (!hadArgs && args) out += ` ${args}`;

    return out.trim();
}

function PlaceholderReference() {
    return (
        <Flex flexDirection="column" gap={4}>
            <Paragraph>Type your prefix and a trigger to send its template. Templates support these placeholders:</Paragraph>
            <Paragraph><InlineCode>{"{args}"}</InlineCode> text you type after the trigger &middot; <InlineCode>{"{mentions}"}</InlineCode> turns IDs after the trigger into pings &middot; <InlineCode>{"{channel}"}</InlineCode> the current channel &middot; <InlineCode>{"{date}"}</InlineCode> today's date &middot; <InlineCode>{"{time}"}</InlineCode> the current time</Paragraph>
        </Flex>
    );
}

export default definePlugin({
    name: "CommandStudio",
    description: "Create custom text commands like .termin that expand into full message templates when you send them.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Chat", "Utility"],
    settings,
    settingsAboutComponent: PlaceholderReference,

    toolboxActions: packsAvailable()
        ? { "Browse Command Packs": openPackGallery }
        : undefined,

    onBeforeMessageSend(channelId, msg, options) {
        const prefix = settings.store.prefix.trim() || ".";
        const content = msg.content.trim();
        if (!content.startsWith(prefix)) return;

        const afterPrefix = content.slice(prefix.length);
        const trigger = afterPrefix.split(/\s/, 1)[0];
        if (!trigger) return;

        const command = getCommand(trigger);
        if (!command) return;

        const args = afterPrefix.slice(trigger.length).trim();
        const expanded = resolvePlaceholders(command.message, args, channelId);

        if (command.mode === "insert") {
            setTimeout(() => insertTextIntoChatInputBox(expanded), 0);
            return { cancel: true };
        }

        if (!expanded) {
            if (options.uploads?.length) {
                msg.content = "";
                return;
            }
            return { cancel: true };
        }

        msg.content = expanded;
    }
});
