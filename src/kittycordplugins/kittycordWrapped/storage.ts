/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { del, get, set } from "@api/DataStore";
import { Settings } from "@api/Settings";
import { ChannelStore, GuildMemberCountStore, GuildStore, RelationshipStore, SnowflakeUtils, UserStore } from "@webpack/common";

export const KEY = "KittycordWrapped";

export const MILESTONES = [100, 500, 1000, 5000, 10000];

const DM_BUCKET = "dms";

export interface WrappedData {
    startedAt: number;
    messages: number;
    byGuild: Record<string, number>;
    byHour: number[];
    byDay: number[];
    activeDates: string[];
}

export interface LiveStats {
    accountCreated: number;
    accountYear: number;
    guildCount: number;
    largestGuild: { name: string; count: number; } | null;
    friendCount: number;
    pluginCount: number;
    themeCount: number;
}

export interface Vibe {
    label: string;
    emoji: string;
    line: string;
}

export interface TopGuild {
    id: string;
    name: string;
    initials: string;
    count: number;
}

export interface WrappedSnapshot {
    vibe: Vibe;
    messages: number;
    startedAt: number;
    top: TopGuild[];
    accountYear: number;
    guildCount: number;
    friendCount: number;
    activeDays: number;
    peakHour: number | null;
    peakDay: number | null;
    pluginCount: number;
    themeCount: number;
    largestGuild: { name: string; count: number; } | null;
    showServerNames: boolean;
}

function emptyData(): WrappedData {
    return {
        startedAt: Date.now(),
        messages: 0,
        byGuild: {},
        byHour: new Array(24).fill(0),
        byDay: new Array(7).fill(0),
        activeDates: []
    };
}

function normalize(stored: Partial<WrappedData>): WrappedData {
    const base = emptyData();
    return {
        startedAt: typeof stored.startedAt === "number" ? stored.startedAt : base.startedAt,
        messages: typeof stored.messages === "number" ? stored.messages : 0,
        byGuild: stored.byGuild ?? {},
        byHour: padArray(stored.byHour, 24),
        byDay: padArray(stored.byDay, 7),
        activeDates: Array.isArray(stored.activeDates) ? stored.activeDates : []
    };
}

function padArray(arr: number[] | undefined, length: number): number[] {
    const out = new Array(length).fill(0);
    if (Array.isArray(arr)) for (let i = 0; i < length; i++) out[i] = arr[i] ?? 0;
    return out;
}

let data: WrappedData | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export async function loadData(): Promise<WrappedData> {
    if (data) return data;
    const stored = await get<WrappedData>(KEY);
    data = stored ? normalize(stored) : emptyData();
    return data;
}

function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
    }, 10_000);
}

export async function flush() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    if (data) await set(KEY, data);
}

export async function resetData() {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    await del(KEY);
    data = emptyData();
}

function localDate(d: Date): string {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${day}`;
}

export function track(channelId: string): number | null {
    const d = data;
    if (!d) return null;

    const guildId = ChannelStore.getChannel(channelId)?.guild_id ?? DM_BUCKET;
    d.messages++;
    d.byGuild[guildId] = (d.byGuild[guildId] ?? 0) + 1;

    const now = new Date();
    d.byHour[now.getHours()]++;
    d.byDay[now.getDay()]++;

    const today = localDate(now);
    if (d.activeDates[d.activeDates.length - 1] !== today && !d.activeDates.includes(today))
        d.activeDates.push(today);

    scheduleFlush();

    return MILESTONES.includes(d.messages) ? d.messages : null;
}

function argmax(arr: number[]): number {
    let best = 0;
    for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
    return best;
}

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function readLive(): LiveStats {
    const user = UserStore.getCurrentUser();
    const created = user ? SnowflakeUtils.extractTimestamp(user.id) : Date.now();
    const guilds = Object.values(GuildStore.getGuilds());

    let largest: { name: string; count: number; } | null = null;
    for (const g of guilds) {
        const count = GuildMemberCountStore.getMemberCount(g.id) ?? (g as any).memberCount ?? 0;
        if (!largest || count > largest.count) largest = { name: g.name, count };
    }

    const pluginCount = Object.values(Settings.plugins).filter(p => p?.enabled).length;
    const themeCount = Settings.enabledThemes?.length ?? 0;

    return {
        accountCreated: created,
        accountYear: new Date(created).getFullYear(),
        guildCount: guilds.length,
        largestGuild: largest,
        friendCount: RelationshipStore.getFriendCount?.() ?? RelationshipStore.getFriendIDs().length,
        pluginCount,
        themeCount
    };
}

export function topGuilds(d: WrappedData, n = 3): TopGuild[] {
    return Object.entries(d.byGuild)
        .filter(([, count]) => count > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([id, count]) => {
            const name = id === DM_BUCKET ? "Direct Messages" : (GuildStore.getGuild(id)?.name ?? "Unknown server");
            const initials = id === DM_BUCKET ? "DM" : initialsOf(name);
            return { id, name, initials, count };
        });
}

function fmtHour(h: number): string {
    const period = h < 12 ? "am" : "pm";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${period}`;
}

export function computeVibe(d: WrappedData, live: LiveStats): Vibe {
    const msgs = d.messages;
    const peak = argmax(d.byHour);

    if (msgs >= 10 && peak >= 0 && peak <= 5)
        return { label: "Night Owl", emoji: "🦉", line: `Most alive at ${fmtHour(peak)}, while the rest of us were asleep.` };
    if (msgs >= 10 && peak >= 5 && peak <= 8)
        return { label: "Early Bird", emoji: "🐦", line: `First one chirping by ${fmtHour(peak)} every day.` };
    if (live.guildCount >= 25)
        return { label: "Server Hopper", emoji: "🐇", line: `${live.guildCount} servers and counting — do you ever sit still?` };
    if (msgs >= 200)
        return { label: "Yapper", emoji: "😼", line: `${msgs.toLocaleString()} messages and the keyboard's still warm.` };
    if (live.guildCount >= 6 && msgs < 30)
        return { label: "Lurker", emoji: "👀", line: `In ${live.guildCount} servers, heard in none. We see you.` };
    if (msgs >= 50)
        return { label: "Chatterbox", emoji: "💬", line: `${msgs.toLocaleString()} messages of pure presence.` };

    return { label: "Fresh Cat", emoji: "🐱", line: "Your Kittycord story is only just getting started." };
}

export function buildSnapshot(showServerNames: boolean): WrappedSnapshot {
    const d = data ?? emptyData();
    const live = readLive();

    return {
        vibe: computeVibe(d, live),
        messages: d.messages,
        startedAt: d.startedAt,
        top: topGuilds(d, 3),
        accountYear: live.accountYear,
        guildCount: live.guildCount,
        friendCount: live.friendCount,
        activeDays: d.activeDates.length,
        peakHour: d.messages ? argmax(d.byHour) : null,
        peakDay: d.messages ? argmax(d.byDay) : null,
        pluginCount: live.pluginCount,
        themeCount: live.themeCount,
        largestGuild: live.largestGuild,
        showServerNames
    };
}
