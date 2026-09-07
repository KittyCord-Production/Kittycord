/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PluginNative } from "@utils/types";
import { MessageAttachment } from "@vencord/discord-types";
import { moment, UserStore } from "@webpack/common";

import { downloadAttachmentText } from "../_shared/dm";
import { sanitizeParams, type StudioParams } from "./template";

export interface ThemeEnvelope {
    v: 1;
    kind: "kittycord-theme";
    sender: { id: string; username: string; };
    created: number;
    params: StudioParams;
}

const FILE_SUFFIX = ".kctheme";
const MAX_THEME_BYTES = 50_000;

const Native = VencordNative?.pluginHelpers?.KittycordStudio as PluginNative<typeof import("./native")> | undefined;

export function buildThemeFile(params: StudioParams): File {
    const me = UserStore.getCurrentUser();
    const envelope: ThemeEnvelope = {
        v: 1,
        kind: "kittycord-theme",
        sender: { id: me?.id ?? "", username: me?.username ?? "Someone" },
        created: Date.now(),
        params
    };
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    const slug = params.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";
    return new File([data], `kittycord-theme-${slug}-${moment().format("YYYY-MM-DD")}${FILE_SUFFIX}`, { type: "application/json" });
}

export function findThemeAttachment(attachments: MessageAttachment[] | undefined): MessageAttachment | null {
    return attachments?.find(a => a.filename?.toLowerCase().endsWith(FILE_SUFFIX)) ?? null;
}

export interface FetchedTheme {
    params: StudioParams;
    sender: string;
}

export async function fetchTheme(attachment: MessageAttachment): Promise<FetchedTheme> {
    const text = await downloadAttachmentText(attachment, Native);
    if (text.length > MAX_THEME_BYTES) throw new Error("That theme file is too large.");

    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("That theme file could not be read.");
    }

    const obj = parsed as { kind?: unknown; v?: unknown; params?: unknown; sender?: { username?: unknown; }; };
    if (!obj || obj.kind !== "kittycord-theme" || typeof obj.v !== "number")
        throw new Error("That file is not a Kittycord theme.");

    return {
        params: sanitizeParams(obj.params),
        sender: typeof obj.sender?.username === "string" ? obj.sender.username.slice(0, 40) : "Someone"
    };
}
