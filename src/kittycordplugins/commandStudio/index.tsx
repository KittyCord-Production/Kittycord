/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, registerCommand, unregisterCommand } from "@api/Commands";
import { SettingsStore } from "@api/Settings";
import { InlineCode } from "@components/CodeBlock";
import { Flex } from "@components/Flex";
import { Paragraph } from "@components/Paragraph";
import { readClipboard } from "@utils/clipboard";
import { insertTextIntoChatInputBox, sendMessage } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import definePlugin from "@utils/types";
import type { Message } from "@vencord/discord-types";
import { ChannelStore, DraftType, GuildStore, Menu, PendingReplyStore, UploadHandler, UploadManager, UserStore } from "@webpack/common";

import { openCommandModal } from "./CommandModal";
import { findShare, ImportCard } from "./ImportCard";
import { openPackGallery, packsAvailable } from "./PackGallery";
import { expand, ExpandContext, PLACEHOLDERS, splitSteps } from "./placeholders";
import { CustomCommand, resolveCommand, settings, SLASH_NAME_RE } from "./settings";
import { bumpUse, getFile, loadStore, toFile, useCount } from "./store";

const logger = new Logger("CommandStudio");
const STEP_DELAY_MS = 600;

let registered: string[] = [];

function inScope(command: CustomCommand, channelId: string) {
    const { scope } = command;
    if (!scope || scope.kind === "everywhere") return true;

    const guildId = ChannelStore.getChannel(channelId)?.guild_id ?? null;
    if (scope.kind === "dms") return guildId === null;

    return guildId !== null && scope.guildIds.includes(guildId);
}

async function buildContext(command: CustomCommand, args: string, channelId: string): Promise<ExpandContext> {
    const channel = ChannelStore.getChannel(channelId);
    const guild = channel?.guild_id ? GuildStore.getGuild(channel.guild_id) : null;
    const reply = PendingReplyStore.getPendingReply(channelId)?.message;

    let clipboard = "";
    if (command.message.includes("{clipboard}")) {
        try {
            clipboard = await readClipboard();
        } catch { }
    }

    return {
        args,
        channelId,
        channelMention: `<#${channelId}>`,
        guildName: guild?.name ?? "",
        selfId: UserStore.getCurrentUser()?.id ?? "",
        replyAuthor: reply?.author?.username ?? "",
        replyText: reply?.content ?? "",
        clipboard,
        useCount: useCount(command.trigger) + 1,
        now: new Date(),
        random: Math.random
    };
}

function attachmentsOf(command: CustomCommand) {
    return (command.attachments ?? []).map(getFile).filter(Boolean);
}

async function sendLaterSteps(channelId: string, steps: string[]) {
    for (const step of steps) {
        await sleep(STEP_DELAY_MS);
        try {
            await sendMessage(channelId, { content: step });
        } catch (err) {
            logger.error("Could not send a follow-up message", err);
            return;
        }
    }
}

function slashName(command: CustomCommand) {
    const name = command.trigger.toLowerCase();
    return SLASH_NAME_RE.test(name) ? name : null;
}

function syncSlashCommands() {
    for (const name of registered) unregisterCommand(name);
    registered = [];

    if (!settings.store.slashCommands) return;

    for (const command of Object.values(settings.store.commands)) {
        if (command.slash === false) continue;

        const name = slashName(command);
        if (!name) continue;

        try {
            registerCommand({
                name,
                description: command.description || `Your ${settings.store.prefix.trim() || "."}${command.trigger} command`,
                inputType: ApplicationCommandInputType.BUILT_IN_TEXT,
                options: [{
                    name: "args",
                    description: "Text to put into the command",
                    type: ApplicationCommandOptionType.STRING,
                    required: false
                }],
                async execute(args, ctx) {
                    const stored = resolveCommand(command.trigger);
                    if (!stored) return;

                    const text = findOption(args, "args", "");
                    const ctxData = await buildContext(stored, text, ctx.channel.id);
                    const steps = splitSteps(expand(stored.message, ctxData));

                    bumpUse(stored.trigger);
                    if (steps.length > 1) sendLaterSteps(ctx.channel.id, steps.slice(1));

                    return { content: steps[0] ?? "" };
                }
            }, "CommandStudio");
            registered.push(name);
        } catch (err) {
            logger.warn(`Could not offer /${name} in the slash menu`, err);
        }
    }
}

function PlaceholderReference() {
    return (
        <Flex flexDirection="column" gap={4}>
            <Paragraph>Type your prefix and a trigger to send its template. Templates understand these placeholders:</Paragraph>
            {PLACEHOLDERS.map(p => (
                <Paragraph key={p.token}><InlineCode>{p.token}</InlineCode> {p.label}</Paragraph>
            ))}
            <Paragraph>
                A line containing only <InlineCode>---</InlineCode> splits your template into several messages that are
                sent one after another.
            </Paragraph>
        </Flex>
    );
}

export default definePlugin({
    name: "CommandStudio",
    description: "Build your own chat commands: templates with arguments, several messages in a row, files, categories and a slash-menu entry for each one.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Chat", "Utility"],
    dependencies: ["MessageAccessoriesAPI", "CommandsAPI"],
    settings,
    settingsAboutComponent: PlaceholderReference,

    toolboxActions: packsAvailable()
        ? { "Browse Command Packs": openPackGallery }
        : undefined,

    contextMenus: {
        "message"(children, { message }: { message: Message; }) {
            if (!message?.content) return;

            children.push(
                <Menu.MenuItem
                    id="kc-save-command"
                    label="Save as command"
                    action={() => openCommandModal({ trigger: "", message: message.content, mode: "send" })}
                />
            );
        }
    },

    renderMessageAccessory({ message }) {
        if (!findShare(message.content ?? "")) return null;
        return <ImportCard message={message} />;
    },

    async onBeforeMessageSend(channelId, msg, options) {
        const prefix = settings.store.prefix.trim() || ".";
        const content = msg.content.trim();
        if (!content.startsWith(prefix)) return;

        const afterPrefix = content.slice(prefix.length);
        const trigger = afterPrefix.split(/\s/, 1)[0];
        if (!trigger) return;

        const command = resolveCommand(trigger);
        if (!command || !inScope(command, channelId)) return;

        const args = afterPrefix.slice(trigger.length).trim();
        const ctx = await buildContext(command, args, channelId);
        const steps = splitSteps(expand(command.message, ctx));
        const files = attachmentsOf(command);

        bumpUse(command.trigger);

        if (files.length) {
            const channel = ChannelStore.getChannel(channelId);
            if (channel) {
                UploadManager.clearAll(channelId, DraftType.ChannelMessage);
                setTimeout(() => UploadHandler.promptToUpload(files.map(toFile), channel, DraftType.ChannelMessage), 10);
                if (steps[0]) setTimeout(() => insertTextIntoChatInputBox(steps.join("\n")), 0);
                return { cancel: true };
            }
        }

        if (command.mode === "insert") {
            setTimeout(() => insertTextIntoChatInputBox(steps.join("\n")), 0);
            return { cancel: true };
        }

        if (!steps.length) {
            if (options.uploads?.length) {
                msg.content = "";
                return;
            }
            return { cancel: true };
        }

        msg.content = steps[0];
        if (steps.length > 1) sendLaterSteps(channelId, steps.slice(1));
    },

    async start() {
        await loadStore();
        syncSlashCommands();
        SettingsStore.addChangeListener("plugins.CommandStudio.commands", syncSlashCommands);
        SettingsStore.addChangeListener("plugins.CommandStudio.slashCommands", syncSlashCommands);
    },

    stop() {
        for (const name of registered) unregisterCommand(name);
        registered = [];
        SettingsStore.removeChangeListener("plugins.CommandStudio.commands", syncSlashCommands);
        SettingsStore.removeChangeListener("plugins.CommandStudio.slashCommands", syncSlashCommands);
    }
});
