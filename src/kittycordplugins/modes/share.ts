/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import type { PluginNative } from "@utils/types";
import { MessageAttachment } from "@vencord/discord-types";
import { moment, UserStore } from "@webpack/common";

import { downloadAttachmentText } from "../_shared/dm";
import type { AutoTrigger, Mode, StatusValue } from "./utils";

export interface ModeEnvelope {
    v: 1;
    kind: "kittycord-mode";
    sender: { id: string; username: string; };
    created: number;
    mode: Mode;
}

const FILE_SUFFIX = ".kcmode";
const MAX_MODE_BYTES = 200_000;
const STATUS_VALUES: StatusValue[] = ["online", "idle", "dnd", "invisible"];

const Native = VencordNative?.pluginHelpers?.Modes as PluginNative<typeof import("./native")> | undefined;

export function buildModeFile(mode: Mode): File {
    const me = UserStore.getCurrentUser();
    const envelope: ModeEnvelope = {
        v: 1,
        kind: "kittycord-mode",
        sender: { id: me?.id ?? "", username: me?.username ?? "Someone" },
        created: Date.now(),
        mode
    };
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    const slug = mode.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "mode";
    return new File([data], `kittycord-mode-${slug}-${moment().format("YYYY-MM-DD")}${FILE_SUFFIX}`, { type: "application/json" });
}

export function findModeAttachment(attachments: MessageAttachment[] | undefined): MessageAttachment | null {
    return attachments?.find(a => a.filename?.toLowerCase().endsWith(FILE_SUFFIX)) ?? null;
}

function sanitizeAuto(auto: any): AutoTrigger | undefined {
    if (!auto || typeof auto !== "object") return undefined;
    if (auto.kind === "time" && typeof auto.start === "string" && typeof auto.end === "string")
        return { kind: "time", start: auto.start.slice(0, 5), end: auto.end.slice(0, 5) };
    if (auto.kind === "game" && Array.isArray(auto.games))
        return { kind: "game", games: auto.games.filter((g: unknown) => typeof g === "string").slice(0, 20) };
    if (auto.kind === "guild" && Array.isArray(auto.guildIds))
        return { kind: "guild", guildIds: auto.guildIds.filter((g: unknown) => /^\d{17,20}$/.test(String(g))).slice(0, 20) };
    return undefined;
}

function sanitizeMode(raw: any): Mode {
    if (!raw || typeof raw !== "object" || typeof raw.name !== "string")
        throw new Error("That file is not a Kittycord mode.");

    const pluginMap: Record<string, boolean> = {};
    if (raw.plugins && typeof raw.plugins === "object") {
        for (const [name, want] of Object.entries(raw.plugins)) {
            if (typeof name === "string" && name.length <= 100 && typeof want === "boolean")
                pluginMap[name] = want;
        }
    }

    return {
        id: crypto.randomUUID(),
        name: raw.name.slice(0, 60).trim() || "Shared mode",
        emoji: typeof raw.emoji === "string" ? raw.emoji.slice(0, 8) : undefined,
        status: STATUS_VALUES.includes(raw.status) ? raw.status : undefined,
        customStatus: raw.customStatus === null
            ? null
            : (raw.customStatus && typeof raw.customStatus.text === "string"
                ? { text: raw.customStatus.text.slice(0, 128), emojiName: typeof raw.customStatus.emojiName === "string" ? raw.customStatus.emojiName.slice(0, 64) : undefined }
                : undefined),
        themes: Array.isArray(raw.themes) ? raw.themes.filter((t: unknown) => typeof t === "string").slice(0, 30) : undefined,
        plugins: Object.keys(pluginMap).length ? pluginMap : undefined,
        auto: sanitizeAuto(raw.auto)
    };
}

export interface FetchedMode {
    mode: Mode;
    sender: string;
    missingPlugins: string[];
}

export async function fetchMode(attachment: MessageAttachment): Promise<FetchedMode> {
    const text = await downloadAttachmentText(attachment, Native);
    if (text.length > MAX_MODE_BYTES) throw new Error("That mode file is too large.");

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("That mode file could not be read.");
    }

    const obj = parsed as { kind?: unknown; v?: unknown; mode?: unknown; sender?: { username?: unknown; }; };
    if (!obj || obj.kind !== "kittycord-mode" || typeof obj.v !== "number")
        throw new Error("That file is not a Kittycord mode.");

    const mode = sanitizeMode(obj.mode);
    const missingPlugins = Object.keys(mode.plugins ?? {}).filter(name => !plugins[name]);

    return {
        mode,
        sender: typeof obj.sender?.username === "string" ? obj.sender.username.slice(0, 40) : "Someone",
        missingPlugins
    };
}
