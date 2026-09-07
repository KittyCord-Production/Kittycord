/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { isPluginEnabled, pluginRequiresRestart, plugins, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { RunningGameStore, SelectedGuildStore } from "@webpack/common";

export type StatusValue = "online" | "idle" | "dnd" | "invisible";

interface CustomStatusSettingValue {
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
}

const StatusSetting = getUserSettingLazy<StatusValue>("status", "status");
const CustomStatusSetting = getUserSettingLazy<CustomStatusSettingValue | null>("status", "customStatus");

export interface ModeCustomStatus {
    text: string;
    emojiName?: string;
}

export type AutoTrigger =
    | { kind: "time"; start: string; end: string; }
    | { kind: "game"; games: string[]; }
    | { kind: "guild"; guildIds: string[]; };

export interface Mode {
    id: string;
    name: string;
    emoji?: string;
    status?: StatusValue;
    customStatus?: ModeCustomStatus | null;
    themes?: string[];
    plugins?: Record<string, boolean>;
    auto?: AutoTrigger;
    isDefault?: boolean;
}

interface Stored {
    modes: Mode[];
    activeId: string | null;
}

const KEY = "Kittycord_Modes";

let modes: Mode[] = [];
let activeId: string | null = null;

export const getModes = () => modes;
export const getActiveId = () => activeId;
export const currentThemes = () => [...Settings.enabledThemes];

export async function loadModes() {
    const data = await get<Stored>(KEY);
    modes = data?.modes ?? [];
    activeId = data?.activeId ?? null;
}

async function persist() {
    await set(KEY, { modes, activeId } satisfies Stored);
}

export async function saveMode(mode: Mode) {
    if (mode.isDefault) modes = modes.map(m => (m.id === mode.id ? m : { ...m, isDefault: false }));
    const existing = modes.findIndex(m => m.id === mode.id);
    if (existing === -1) modes = [...modes, mode];
    else modes = modes.map(m => (m.id === mode.id ? mode : m));
    await persist();
    evaluateAuto();
}

export async function deleteMode(id: string) {
    modes = modes.filter(m => m.id !== id);
    if (activeId === id) activeId = null;
    await persist();
    evaluateAuto();
}

export function newMode(name: string): Mode {
    return { id: crypto.randomUUID(), name, plugins: {} };
}

export function captureInto(mode: Mode): Mode {
    const status = StatusSetting?.getSetting?.();
    const cs = CustomStatusSetting?.getSetting?.();
    return {
        ...mode,
        status: status ?? mode.status,
        customStatus: cs?.text ? { text: cs.text, emojiName: cs.emojiName || undefined } : mode.customStatus,
        themes: currentThemes()
    };
}

export function getTogglablePlugins(): { value: string; label: string; }[] {
    return Object.values(plugins)
        .filter(p => !p.required && !p.name.endsWith("API") && p.name !== "Modes")
        .map(p => ({ value: p.name, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

export async function applyMode(mode: Mode): Promise<{ restartNeeded: boolean; }> {
    let restartNeeded = false;

    if (mode.status && StatusSetting) await StatusSetting.updateSetting(mode.status);

    if (mode.customStatus !== undefined && CustomStatusSetting) {
        const cs = mode.customStatus;
        await CustomStatusSetting.updateSetting(cs
            ? { text: cs.text, emojiName: cs.emojiName ?? "", emojiId: "0", expiresAtMs: "0" }
            : null);
    }

    if (mode.themes) Settings.enabledThemes = [...mode.themes];

    if (mode.plugins) {
        for (const [name, want] of Object.entries(mode.plugins)) {
            const p = plugins[name];
            if (!p || p.required) continue;
            if (isPluginEnabled(name) === want) continue;

            Settings.plugins[name].enabled = want;
            if (pluginRequiresRestart(p)) restartNeeded = true;
            else if (!(want ? startPlugin(p) : stopPlugin(p))) restartNeeded = true;
        }
    }

    activeId = mode.id;
    await persist();
    return { restartNeeded };
}

const PRIORITY = { game: 0, guild: 1, time: 2 } as const;

let enabled = false;
let autoTimer: ReturnType<typeof setInterval> | null = null;
let listening = false;
let autoAppliedId: string | null = null;
let lastBest: string | null | undefined;

function nowHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function inWindow(now: string, start: string, end: string): boolean {
    if (start === end) return false;
    if (start < end) return now >= start && now < end;
    return now >= start || now < end;
}

export function runningGameNames(): string[] {
    return (RunningGameStore?.getRunningGames?.() ?? []).map(g => g.name?.trim()).filter(Boolean) as string[];
}

function triggerMatches(t: AutoTrigger): boolean {
    switch (t.kind) {
        case "time":
            return inWindow(nowHHMM(), t.start, t.end);
        case "game": {
            const names = runningGameNames().map(n => n.toLowerCase());
            return t.games.some(g => names.includes(g.toLowerCase().trim()));
        }
        case "guild":
            return t.guildIds.includes(SelectedGuildStore?.getGuildId?.() ?? "");
    }
}

function bestMatch(): Mode | null {
    const matches = modes
        .map(m => (m.auto && triggerMatches(m.auto) ? { mode: m, auto: m.auto } : null))
        .filter((m): m is { mode: Mode; auto: AutoTrigger; } => m !== null);
    if (!matches.length) return null;
    return [...matches].sort((a, b) => PRIORITY[a.auto.kind] - PRIORITY[b.auto.kind])[0].mode;
}

export async function evaluateAuto() {
    if (!enabled || !modes.some(m => m.auto)) return;

    const best = bestMatch();
    const bestId = best?.id ?? null;
    if (bestId === lastBest) return;
    lastBest = bestId;

    if (best) {
        if (best.id !== activeId) await applyMode(best);
        autoAppliedId = best.id;
    } else if (activeId && activeId === autoAppliedId) {
        const def = modes.find(m => m.isDefault);
        if (def && def.id !== activeId) {
            await applyMode(def);
            autoAppliedId = def.id;
        }
    }
}

export function notifyManualActivation() {
    autoAppliedId = null;
}

export function startAuto() {
    enabled = true;
    autoAppliedId = null;
    lastBest = undefined;
    if (autoTimer == null) autoTimer = setInterval(evaluateAuto, 30_000);
    if (!listening) {
        SelectedGuildStore?.addChangeListener?.(evaluateAuto);
        RunningGameStore?.addChangeListener?.(evaluateAuto);
        listening = true;
    }
    evaluateAuto();
}

export function stopAuto() {
    enabled = false;
    autoAppliedId = null;
    lastBest = undefined;
    if (autoTimer != null) {
        clearInterval(autoTimer);
        autoTimer = null;
    }
    if (listening) {
        SelectedGuildStore?.removeChangeListener?.(evaluateAuto);
        RunningGameStore?.removeChangeListener?.(evaluateAuto);
        listening = false;
    }
}
