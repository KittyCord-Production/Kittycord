/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { exportSettings, importSettings } from "@api/SettingsSync/offline";
import { Logger } from "@utils/Logger";
import { sleep } from "@utils/misc";
import type { PluginNative } from "@utils/types";
import { CloudUpload, MessageAttachment } from "@vencord/discord-types";
import { CloudUploadPlatform } from "@vencord/discord-types/enums";
import { findLazy } from "@webpack";
import { ChannelActionCreators, ChannelStore, Constants, moment, RestAPI, SnowflakeUtils, UserStore } from "@webpack/common";

const logger = new Logger("ShareSetup");

export type ShareScope = "plugins" | "css" | "all";

export interface ShareEnvelope {
    v: 1;
    kind: "kittycord-share";
    sender: { id: string; username: string; };
    created: number;
    scope: ShareScope;
    enabledPlugins: string[];
    body: string;
}

const FILE_SUFFIX = ".kcshare";
const MAX_SHARE_BYTES = 2_000_000;

const CloudUploader = findLazy(m => m.prototype?.trackUploadFinished) as typeof CloudUpload;
const Native = VencordNative?.pluginHelpers?.ShareSetup as PluginNative<typeof import("./native")> | undefined;

function enabledPluginNames(): string[] {
    return Object.values(plugins)
        .filter(p => !p.required && !p.name.endsWith("API") && isPluginEnabled(p.name))
        .map(p => p.name)
        .sort((a, b) => a.localeCompare(b));
}

export async function buildEnvelopeFile(scope: ShareScope): Promise<File> {
    const body = (await exportSettings({ type: scope, syncDataStore: scope === "all" })) ?? "{}";
    const me = UserStore.getCurrentUser();
    const envelope: ShareEnvelope = {
        v: 1,
        kind: "kittycord-share",
        sender: { id: me?.id ?? "", username: me?.username ?? "Someone" },
        created: Date.now(),
        scope,
        enabledPlugins: enabledPluginNames(),
        body
    };
    const data = new TextEncoder().encode(JSON.stringify(envelope));
    return new File([data], `kittycord-setup-${moment().format("YYYY-MM-DD")}${FILE_SUFFIX}`, { type: "application/json" });
}

async function waitForDmChannel(userId: string, timeoutMs = 3000): Promise<string | null> {
    const started = Date.now();
    do {
        const id = ChannelStore.getDMFromUserId?.(userId) ?? null;
        if (id) return id;
        await sleep(80);
    } while (Date.now() - started < timeoutMs);
    return null;
}

async function ensureDmChannel(userId: string): Promise<string | null> {
    const existing = ChannelStore.getDMFromUserId?.(userId);
    if (existing) return existing;

    let result: unknown;
    try {
        result = await Promise.resolve(ChannelActionCreators.openPrivateChannel({ recipientIds: [userId], navigateToChannel: false }));
    } catch {
        result = null;
    }
    if (typeof result === "string") return result;

    return waitForDmChannel(userId);
}

function uploadAttachment(channelId: string, file: File): Promise<{ id: string; filename: string; uploaded_filename: string; } | null> {
    return new Promise(resolve => {
        const upload = new CloudUploader({ file, platform: CloudUploadPlatform.WEB }, channelId);
        upload.on("complete", () => resolve({ id: "0", filename: upload.filename, uploaded_filename: upload.uploadedFilename }));
        upload.on("error", () => resolve(null));
        upload.upload();
    });
}

export async function sendShare(userId: string, scope: ShareScope, note: string) {
    const file = await buildEnvelopeFile(scope);

    const channelId = await ensureDmChannel(userId);
    if (!channelId) throw new Error("Could not open a DM with that user.");

    const attachment = await uploadAttachment(channelId, file);
    if (!attachment) throw new Error("Upload failed. Please try again.");

    await RestAPI.post({
        url: Constants.Endpoints.MESSAGES(channelId),
        body: {
            content: note,
            nonce: SnowflakeUtils.fromTimestamp(Date.now()),
            channel_id: channelId,
            sticker_ids: [],
            type: 0,
            attachments: [attachment]
        }
    });
}

export function findShareAttachment(attachments: MessageAttachment[] | undefined): MessageAttachment | null {
    return attachments?.find(a => a.filename?.toLowerCase().endsWith(FILE_SUFFIX)) ?? null;
}

function parseEnvelope(text: string): ShareEnvelope {
    if (text.length > MAX_SHARE_BYTES) throw new Error("That setup file is too large.");

    let obj: any;
    try {
        obj = JSON.parse(text);
    } catch {
        throw new Error("That setup file could not be read.");
    }

    if (!obj || obj.kind !== "kittycord-share" || typeof obj.v !== "number" || typeof obj.body !== "string")
        throw new Error("That file is not a Kittycord setup.");
    if (obj.scope !== "plugins" && obj.scope !== "css" && obj.scope !== "all")
        throw new Error("That setup uses an unknown scope.");

    return obj as ShareEnvelope;
}

async function refreshCdnUrl(url: string): Promise<string | null> {
    try {
        const res = await RestAPI.post({
            url: Constants.Endpoints.ATTACHMENTS_REFRESH_URLS,
            body: { attachment_urls: [url] }
        });
        const refreshed = res?.body?.refreshed_urls?.[0]?.refreshed;
        return typeof refreshed === "string" ? refreshed : null;
    } catch {
        return null;
    }
}

async function downloadSetupText(attachment: MessageAttachment): Promise<string> {
    const url = attachment.url || attachment.proxy_url;

    if (Native) {
        let r = await Native.downloadSetup(url);
        if (!r.ok) {
            const fresh = await refreshCdnUrl(url);
            if (fresh) r = await Native.downloadSetup(fresh);
        }
        if (r.ok) return r.data;
        throw new Error("Could not download that setup file.");
    }

    const webUrl = attachment.proxy_url || attachment.url;
    let res = await fetch(webUrl);
    if (!res.ok) {
        const fresh = await refreshCdnUrl(webUrl);
        if (fresh) res = await fetch(fresh);
    }
    if (!res.ok) throw new Error("Could not download that setup file.");
    return res.text();
}

export async function fetchShare(attachment: MessageAttachment): Promise<ShareEnvelope> {
    return parseEnvelope(await downloadSetupText(attachment));
}

export async function applyShare(envelope: ShareEnvelope) {
    await importSettings(envelope.body, envelope.scope, false);
    logger.info(`Imported a shared setup (${envelope.scope}) from ${envelope.sender.username}`);
}
