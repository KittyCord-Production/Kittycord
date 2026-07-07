/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { getLyrics } from "@equicordplugins/musicControls/spotify/lyrics/api";
import { LyricsData, SyncedLyric } from "@equicordplugins/musicControls/spotify/lyrics/providers/types";
import { SpotifyStore, Track } from "@equicordplugins/musicControls/spotify/SpotifyStore";
import definePlugin, { OptionType } from "@utils/types";

interface CustomStatusValue {
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
}

const CustomStatusSetting = getUserSettingLazy<CustomStatusValue | null>("status", "customStatus");

const MAX_STATUS_LENGTH = 128;

const settings = definePluginSettings({
    statusText: {
        type: OptionType.SELECT,
        description: "What to show while Spotify plays. The lyric line updates your status every few seconds.",
        options: [
            { label: "Artist and song", value: "track", default: true },
            { label: "Current lyric line", value: "lyrics" }
        ]
    },
    statusEmoji: {
        type: OptionType.STRING,
        description: "Emoji shown next to the status. Leave empty for none.",
        default: "🎵"
    }
});

let overriding = false;
let saved: CustomStatusValue | null = null;
let lastText: string | null = null;
let lyrics: LyricsData | null = null;
let lyricsId: string | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function clip(text: string): string {
    return text.length > MAX_STATUS_LENGTH ? text.slice(0, MAX_STATUS_LENGTH) : text;
}

function trackText(track: Track): string {
    const artists = track.artists?.map(a => a.name).filter(Boolean).join(", ");
    return artists ? `${artists} - ${track.name}` : track.name;
}

function currentLyricText(data: LyricsData, positionMs: number): string | null {
    const lines = data.lyricsVersions[data.useLyric];
    if (!lines?.length) return null;

    const posSec = positionMs / 1000;
    let current: SyncedLyric | null = null;
    for (const line of lines) {
        if (line.time <= posSec) current = line;
        else break;
    }

    if (!current || posSec - current.time > 8) return null;
    return current.text;
}

function desiredText(track: Track | null): string | null {
    if (!track) return null;

    if (settings.store.statusText === "lyrics" && lyrics) {
        const line = currentLyricText(lyrics, SpotifyStore.position);
        if (line) return clip(line);
    }

    return clip(trackText(track));
}

async function refetchIfNeeded(track: Track | null) {
    if (settings.store.statusText !== "lyrics") return;
    if (!track) {
        lyrics = null;
        lyricsId = null;
        return;
    }
    if (track.id === lyricsId) return;

    const { id } = track;
    lyricsId = id;
    lyrics = null;
    const data = await getLyrics(track);
    if (lyricsId === id) lyrics = data;
}

function apply() {
    if (!CustomStatusSetting) return;

    const text = SpotifyStore.device?.is_active ? desiredText(SpotifyStore.track) : null;

    if (text == null) {
        if (overriding) {
            CustomStatusSetting.updateSetting(saved);
            overriding = false;
            lastText = null;
        }
        return;
    }

    if (!overriding) {
        saved = CustomStatusSetting.getSetting() ?? null;
        overriding = true;
    }

    if (text !== lastText) {
        CustomStatusSetting.updateSetting({
            text,
            emojiName: settings.store.statusEmoji || "",
            emojiId: "0",
            expiresAtMs: "0"
        });
        lastText = text;
    }
}

export default definePlugin({
    name: "SpotifyStatus",
    description: "Show your currently playing Spotify song, or its live lyrics, in your custom status.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Activity", "Media"],
    dependencies: ["UserSettingsAPI"],
    searchTerms: ["spotify", "status", "now playing", "lyrics"],
    settings,

    flux: {
        async SPOTIFY_PLAYER_STATE(e: { track: Track | null; }) {
            await refetchIfNeeded(e.track);
            apply();
        }
    },

    start() {
        apply();
        timer = setInterval(apply, 2000);
    },

    stop() {
        if (timer) clearInterval(timer);
        timer = null;

        if (overriding && CustomStatusSetting) CustomStatusSetting.updateSetting(saved);
        overriding = false;
        saved = null;
        lastText = null;
        lyrics = null;
        lyricsId = null;
    }
});
