/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { RuleList } from "./RuleList";

const SOUND_CDN = "https://kittycord-analytics.hell-bullet-hb.workers.dev/sounds";
const AUDIO_KEY = "SoundStudio_Audio";
const SHARE_PREFIX = "KSND1:";

export const MAX_FILE_BYTES = 300_000;
export const MAX_FILES = 20;
const INLINE_MAX_CHARS = 64_000;
const SHARE_MAX_CHARS = 200_000;
const MAX_RULES = 100;

export const CURATED = [
    { id: "chime", label: "Chime" },
    { id: "ping", label: "Ping" },
    { id: "bell", label: "Bell" },
    { id: "marimba", label: "Marimba" },
    { id: "pop", label: "Pop" },
    { id: "purr", label: "Purr" }
] as const;

const CURATED_IDS = new Set(CURATED.map(c => c.id as string));
const ALLOWED_MIME = new Set(["audio/mpeg", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/mp4", "audio/aac", "audio/flac"]);

export const SCOPES = ["friend", "guild", "channel"] as const;
export type RuleScope = typeof SCOPES[number];

export type RuleSound =
    | { kind: "curated"; id: string; }
    | { kind: "file"; fileId: string; };

export interface SoundRule {
    id: string;
    scope: RuleScope;
    targetId: string;
    sound: RuleSound;
    volume: number;
}

export interface StoredAudio {
    name: string;
    mime: string;
    dataUri: string;
}

export const soundUrl = (id: string) => `${SOUND_CDN}/${id}.wav`;

export const settings = definePluginSettings({
    rules: {
        type: OptionType.CUSTOM,
        description: "",
        default: [] as SoundRule[]
    },
    ruleList: {
        type: OptionType.COMPONENT,
        component: RuleList
    }
});

const audioCache = new Map<string, StoredAudio>();

export async function loadAudioCache() {
    const stored = (await get<Record<string, StoredAudio>>(AUDIO_KEY)) ?? {};
    audioCache.clear();
    for (const [id, entry] of Object.entries(stored)) audioCache.set(id, entry);
}

export function clearAudioCache() {
    audioCache.clear();
}

export const getAudio = (fileId: string) => audioCache.get(fileId);
export const listAudio = () => [...audioCache.entries()].map(([fileId, entry]) => ({ fileId, ...entry }));

async function persistAudio() {
    await set(AUDIO_KEY, Object.fromEntries(audioCache));
}

export async function addAudio(name: string, mime: string, dataUri: string): Promise<string> {
    if (audioCache.size >= MAX_FILES) throw new Error(`You can keep at most ${MAX_FILES} sounds.`);
    const fileId = crypto.randomUUID();
    audioCache.set(fileId, { name, mime, dataUri });
    await persistAudio();
    return fileId;
}

export async function removeAudio(fileId: string) {
    audioCache.delete(fileId);
    await persistAudio();
}

export function resolveSound(sound: RuleSound): string | null {
    if (sound.kind === "curated") return CURATED_IDS.has(sound.id) ? soundUrl(sound.id) : null;
    return audioCache.get(sound.fileId)?.dataUri ?? null;
}

export function soundLabel(sound: RuleSound): string {
    if (sound.kind === "curated") return CURATED.find(c => c.id === sound.id)?.label ?? sound.id;
    return audioCache.get(sound.fileId)?.name ?? "Missing sound";
}

export function addRule(rule: Omit<SoundRule, "id">) {
    const rules = settings.store.rules.filter(r => !(r.scope === rule.scope && r.targetId === rule.targetId));
    settings.store.rules = [...rules, { ...rule, id: crypto.randomUUID() }];
}

export function removeRule(id: string) {
    settings.store.rules = settings.store.rules.filter(r => r.id !== id);
}

export function findRule(scope: RuleScope, targetId: string) {
    return settings.store.rules.find(r => r.scope === scope && r.targetId === targetId);
}

export function matchRule(authorId?: string, channelId?: string, guildId?: string): SoundRule | undefined {
    const { rules } = settings.store;
    if (!rules.length) return undefined;
    return (authorId ? rules.find(r => r.scope === "friend" && r.targetId === authorId) : undefined)
        ?? (channelId ? rules.find(r => r.scope === "channel" && r.targetId === channelId) : undefined)
        ?? (guildId ? rules.find(r => r.scope === "guild" && r.targetId === guildId) : undefined);
}

function clampVolume(value: unknown): number {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return 100;
    return Math.min(100, Math.max(0, n));
}

export function exportRules(rules: SoundRule[]): { code: string; skipped: number; } {
    const out: unknown[] = [];
    let skipped = 0;

    for (const rule of rules) {
        const base = { scope: rule.scope, targetId: rule.targetId, volume: rule.volume };
        if (rule.sound.kind === "curated") {
            out.push({ ...base, sound: { kind: "curated", id: rule.sound.id } });
            continue;
        }
        const file = audioCache.get(rule.sound.fileId);
        if (!file || file.dataUri.length > INLINE_MAX_CHARS) {
            skipped++;
            continue;
        }
        out.push({ ...base, sound: { kind: "inline", name: file.name, mime: file.mime, dataUri: file.dataUri } });
    }

    const code = SHARE_PREFIX + btoa(encodeURIComponent(JSON.stringify({ v: 1, rules: out })));
    return { code, skipped };
}

export async function importRules(code: string): Promise<{ added: number; } | null> {
    const trimmed = code.trim();
    if (!trimmed.startsWith(SHARE_PREFIX) || trimmed.length > SHARE_MAX_CHARS) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(decodeURIComponent(atob(trimmed.slice(SHARE_PREFIX.length))));
    } catch {
        return null;
    }

    const raw = (parsed as { rules?: unknown; })?.rules;
    if (!Array.isArray(raw)) return null;

    let added = 0;
    for (const entry of raw.slice(0, MAX_RULES)) {
        if (!entry || typeof entry !== "object") continue;
        const { scope, targetId, volume, sound } = entry as Record<string, any>;
        if (!SCOPES.includes(scope)) continue;
        if (typeof targetId !== "string" || !/^\d{17,20}$/.test(targetId)) continue;
        if (!sound || typeof sound !== "object") continue;

        let resolved: RuleSound | null = null;
        if (sound.kind === "curated" && typeof sound.id === "string" && CURATED_IDS.has(sound.id)) {
            resolved = { kind: "curated", id: sound.id };
        } else if (sound.kind === "inline") {
            const { name, mime, dataUri } = sound as Record<string, unknown>;
            if (typeof mime !== "string" || !ALLOWED_MIME.has(mime)) continue;
            if (typeof dataUri !== "string" || !dataUri.startsWith(`data:${mime};base64,`) || dataUri.length > INLINE_MAX_CHARS) continue;
            if (audioCache.size >= MAX_FILES) continue;
            const fileId = await addAudio(typeof name === "string" && name ? name.slice(0, 60) : "Shared sound", mime, dataUri);
            resolved = { kind: "file", fileId };
        }
        if (!resolved) continue;

        addRule({ scope, targetId, sound: resolved, volume: clampVolume(volume) });
        added++;
    }

    return added ? { added } : null;
}

export function isAllowedMime(mime: string) {
    return ALLOWED_MIME.has(mime);
}
