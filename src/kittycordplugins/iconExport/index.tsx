/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import { StickerFormatType } from "@vencord/discord-types/enums";
import { EmojiStore, StickersStore } from "@webpack/common";

import { formatIcons, type IconFormat, type IconItem } from "./format";

const StickerExt = {
    [StickerFormatType.PNG]: "png",
    [StickerFormatType.APNG]: "png",
    [StickerFormatType.LOTTIE]: "json",
    [StickerFormatType.GIF]: "gif"
} as const;

const choice = (value: string, label: string) => ({ name: value, value, label });

function collect(guildId: string, type: string): IconItem[] {
    const cdn = `https://${window.GLOBAL_ENV.CDN_HOST}`;
    const items: IconItem[] = [];

    if (type !== "stickers") {
        for (const e of EmojiStore.getGuildEmoji(guildId)) {
            items.push({ kind: "emoji", id: e.id, name: e.name, url: `${cdn}/emojis/${e.id}.${e.animated ? "gif" : "png"}` });
        }
    }

    if (type !== "emojis") {
        for (const s of StickersStore.getStickersByGuildId(guildId) ?? []) {
            items.push({ kind: "sticker", id: s.id, name: s.name, url: `${cdn}/stickers/${s.id}.${StickerExt[s.format_type] ?? "png"}` });
        }
    }

    return items;
}

export default definePlugin({
    name: "IconExport",
    description: "Adds /icons to copy every emoji and sticker of the current server as a Markdown table, JSON or a plain URL list - handy for bots and logs.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Servers"],
    dependencies: ["CommandsAPI"],

    commands: [
        {
            name: "icons",
            description: "Copy all emojis and stickers of this server to your clipboard",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                {
                    name: "type",
                    description: "What to export (default: all)",
                    type: ApplicationCommandOptionType.STRING,
                    required: false,
                    choices: [choice("all", "Emojis and stickers"), choice("emojis", "Emojis only"), choice("stickers", "Stickers only")]
                },
                {
                    name: "format",
                    description: "Output format (default: markdown)",
                    type: ApplicationCommandOptionType.STRING,
                    required: false,
                    choices: [choice("markdown", "Markdown table"), choice("json", "JSON"), choice("urls", "URL list")]
                }
            ],
            execute: async (args, ctx) => {
                const reply = (content: string) => sendBotMessage(ctx.channel.id, { content });

                if (!ctx.guild) return reply("`/icons` only works inside a server.");

                const items = collect(ctx.guild.id, findOption(args, "type", "all"));
                if (!items.length) return reply("This server has nothing to export.");

                const format = findOption<IconFormat>(args, "format", "markdown");
                try {
                    await copyToClipboard(formatIcons(items, format));
                } catch {
                    return reply("Couldn't write to the clipboard.");
                }

                const emojis = items.filter(i => i.kind === "emoji").length;
                reply(`Copied ${emojis} emojis and ${items.length - emojis} stickers as ${format}. Paste them anywhere.`);
            }
        }
    ]
});
