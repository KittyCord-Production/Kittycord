/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { type ChildProcessWithoutNullStreams, execFile, spawn } from "child_process";
import { join } from "path";
import { promisify } from "util";

import type { TrackData } from ".";

const exec = promisify(execFile);

async function applescript(cmds: string[]) {
    const { stdout } = await exec("osascript", cmds.map(c => ["-e", c]).flat());
    return stdout;
}

interface RemoteData {
    appleMusicLink?: string,
    appleMusicArtistLink?: string;
    songLink?: string,
    albumArtwork?: string,
    artistArtwork?: string;
}

let cachedRemoteData: { id: string, data: RemoteData; } | { id: string, failures: number; } | null = null;

async function fetchRemoteData({ id, name, artist, album }: { id: string, name: string, artist: string, album: string; }) {
    if (id === cachedRemoteData?.id) {
        if ("data" in cachedRemoteData) return cachedRemoteData.data;
        if ("failures" in cachedRemoteData && cachedRemoteData.failures >= 5) return null;
    }

    try {
        const dataUrl = new URL("https://itunes.apple.com/search");
        dataUrl.searchParams.set("term", `${name} ${artist} ${album}`);
        dataUrl.searchParams.set("media", "music");
        dataUrl.searchParams.set("entity", "song");

        const fetchData = () => fetch(dataUrl, {
            headers: {
                "user-agent": VENCORD_USER_AGENT,
            },
        }).then(r => r.json());

        let data = await fetchData();

        if (data.resultCount === 0) {
            dataUrl.searchParams.set("term", `${name} ${artist}`);
            data = await fetchData();
        }

        const songData = data.results.find(song => song.collectionName === album) || data.results[0];

        const artistArtworkURL = await fetch(songData.artistViewUrl)
            .then(r => r.text())
            .then(data => {
                const match = data.match(/<meta property="og:image" content="(.+?)">/);
                return match ? match[1].replace(/[0-9]+x.+/, "220x220bb-60.png") : undefined;
            })
            .catch(() => void 0);

        cachedRemoteData = {
            id,
            data: {
                appleMusicLink: songData.trackViewUrl,
                appleMusicArtistLink: songData.artistViewUrl,
                songLink: `https://song.link/i/${new URL(songData.trackViewUrl).searchParams.get("i")}`,
                albumArtwork: (songData.artworkUrl100).replace("100x100", "512x512"),
                artistArtwork: artistArtworkURL
            }
        };

        return cachedRemoteData.data;
    } catch (e) {
        console.error("[AppleMusicRichPresence] Failed to fetch remote data:", e);
        cachedRemoteData = {
            id,
            failures: (id === cachedRemoteData?.id && "failures" in cachedRemoteData ? cachedRemoteData.failures : 0) + 1
        };
        return null;
    }
}

const POWERSHELL = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");

const HELPER_SCRIPT = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$stdout = [Console]::OpenStandardOutput()
$utf8 = New-Object System.Text.UTF8Encoding $false
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, $type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); if (-not $task.Wait(5000)) { throw 'timed out' }; $task.Result }
function Emit($data) { $bytes = $utf8.GetBytes(($data | ConvertTo-Json -Compress) + [char]10); $stdout.Write($bytes, 0, $bytes.Length); $stdout.Flush() }
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime] | Out-Null
$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]
$manager = Await ($managerType::RequestAsync()) ($managerType)
$parent = [System.Diagnostics.Process]::GetProcessById(${process.pid})
while (-not $parent.HasExited) {
    try {
        $sessions = $manager.GetSessions()
        $session = $sessions | Where-Object { $_.SourceAppUserModelId -match 'applemusic|apple.music|itunes' } | Select-Object -First 1
        if ($null -eq $session) {
            Emit @{ status = 'None'; sessions = (($sessions | ForEach-Object { $_.SourceAppUserModelId }) -join '|') }
        } else {
            $properties = Await ($session.TryGetMediaPropertiesAsync()) ($propertiesType)
            $timeline = $session.GetTimelineProperties()
            $playback = $session.GetPlaybackInfo()
            Emit @{
                status = $playback.PlaybackStatus.ToString()
                name = $properties.Title
                artist = $properties.Artist
                album = $properties.AlbumTitle
                position = $timeline.Position.TotalSeconds
                start = $timeline.StartTime.TotalSeconds
                duration = $timeline.EndTime.TotalSeconds
                updated = $timeline.LastUpdatedTime.ToUnixTimeMilliseconds()
                rate = [double]$playback.PlaybackRate
            }
        }
    } catch {
        Emit @{ status = 'Error' }
    }
    Start-Sleep -Seconds 1
}
`;

interface Snapshot {
    status: string;
    name?: string;
    artist?: string;
    album?: string;
    position?: number;
    start?: number;
    duration?: number;
    updated?: number;
    rate?: number;
    sessions?: string;
}

let helper: ChildProcessWithoutNullStreams | null = null;
let snapshot: Snapshot | null = null;
let snapshotAt = 0;
let failures = 0;
let retryAt = 0;
let loggedSessions: string | null = null;

function helperGone(child: ChildProcessWithoutNullStreams) {
    if (helper !== child) return;

    helper = null;
    snapshot = null;
    failures++;
    retryAt = Date.now() + Math.min(60_000, 5_000 * 2 ** (failures - 1));
}

function readHelperLine(line: string) {
    let parsed: Snapshot;
    try {
        parsed = JSON.parse(line);
    } catch {
        return;
    }

    failures = 0;
    snapshot = parsed.status === "Error" ? null : parsed;
    snapshotAt = Date.now();

    if (IS_DEV && parsed.sessions !== undefined && parsed.sessions !== loggedSessions) {
        loggedSessions = parsed.sessions;
        console.log("[AppleMusicRichPresence] No Apple Music session. Currently playing apps:", parsed.sessions || "none");
    }
}

function ensureHelper() {
    if (helper || Date.now() < retryAt) return;

    const child = spawn(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", HELPER_SCRIPT], { windowsHide: true });
    helper = child;

    let buffered = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
        buffered += chunk;
        const lines = buffered.split("\n");
        buffered = lines.pop() ?? "";
        for (const line of lines) readHelperLine(line);
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => console.error("[AppleMusicRichPresence] Media session helper:", chunk.slice(0, 500)));

    child.on("error", e => {
        console.error("[AppleMusicRichPresence] Could not start the media session helper:", e.message);
        helperGone(child);
    });
    child.on("exit", () => helperGone(child));
}

export function stopHelper() {
    failures = 0;
    retryAt = 0;

    if (!helper) return;

    const child = helper;
    helper = null;
    snapshot = null;
    child.kill();
}

async function fetchWindowsTrackData(): Promise<TrackData | null> {
    ensureHelper();

    const snap = snapshot;
    if (!snap || snap.status !== "Playing" || Date.now() - snapshotAt > 10_000) return null;

    const { name } = snap;
    if (!name) return null;

    const { position = 0, start = 0, updated = 0 } = snap;
    let { artist = "", album = "" } = snap;

    const separator = album ? -1 : artist.indexOf(" — ");
    if (separator !== -1) {
        album = artist.slice(separator + 3);
        artist = artist.slice(0, separator);
    }

    const duration = (snap.duration ?? 0) - start;
    const remoteData = await fetchRemoteData({ id: `${name}\n${artist}\n${album}`, name, artist, album });

    if (!(duration > 0)) return { name, album, artist, playerPosition: 0, duration: NaN, ...remoteData };

    const rate = snap.rate || 1;
    const elapsed = updated > 0 ? (Date.now() - updated) / 1000 : 0;
    const playerPosition = Math.min(duration, position - start + elapsed * rate);

    return { name, album, artist, playerPosition, duration, ...remoteData };
}

export async function fetchTrackData(): Promise<TrackData | null> {
    if (process.platform === "win32") return fetchWindowsTrackData();
    if (process.platform !== "darwin") return null;

    try {
        await exec("pgrep", ["^Music$"]);
    } catch (error) {
        return null;
    }

    const playerState = await applescript(['tell application "Music"', "get player state", "end tell"])
        .then(out => out.trim());
    if (playerState !== "playing") return null;

    const playerPosition = await applescript(['tell application "Music"', "get player position", "end tell"])
        .then(text => Number.parseFloat(text.trim()));

    const stdout = await applescript([
        'set output to ""',
        'tell application "Music"',
        "set t_id to database id of current track",
        "set t_name to name of current track",
        "set t_album to album of current track",
        "set t_artist to artist of current track",
        "set t_duration to duration of current track",
        'set output to "" & t_id & "\\n" & t_name & "\\n" & t_album & "\\n" & t_artist & "\\n" & t_duration',
        "end tell",
        "return output"
    ]);

    const [id, name, album, artist, durationStr] = stdout.split("\n").filter(k => !!k);
    const duration = Number.parseFloat(durationStr);

    const remoteData = await fetchRemoteData({ id, name, artist, album });

    return { name, album, artist, playerPosition, duration, ...remoteData };
}
