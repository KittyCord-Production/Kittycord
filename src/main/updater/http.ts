/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { fetchBuffer, fetchJson } from "@main/utils/http";
import { IpcEvents } from "@shared/IpcEvents";
import { VENCORD_USER_AGENT } from "@shared/vencordUserAgent";
import { createHash } from "crypto";
import { ipcMain } from "electron";
import { writeFileSync } from "original-fs";

import gitHash from "~git-hash";
import gitRemote from "~git-remote";

import { ASAR_FILE, serializeErrors } from "./common";

const API_BASE = `https://api.github.com/repos/${gitRemote}`;
const RELEASE_DOWNLOAD_BASE = `https://github.com/${gitRemote}/releases/latest/download`;
let PendingUpdate: string | null = null;

async function githubGet<T = any>(endpoint: string) {
    return fetchJson<T>(API_BASE + endpoint, {
        headers: {
            Accept: "application/vnd.github+json",
            // "All API requests MUST include a valid User-Agent header.
            // Requests with no User-Agent header will be rejected."
            "User-Agent": VENCORD_USER_AGENT
        }
    });
}

async function calculateGitChanges() {
    const isOutdated = await fetchUpdates();
    if (!isOutdated) return [];

    // The per-commit changelog still uses the GitHub API. If that is rate-limited or fails, we
    // still report that an update is available (just without the detailed commit list).
    try {
        const data = await githubGet(`/compare/${gitHash}...HEAD`);

        return data.commits.map((c: any) => ({
            hash: c.sha,
            author: c.author?.login ?? c.commit?.author?.name ?? "Unknown Author",
            message: c.commit.message.split("\n")[0]
        }));
    } catch {
        return [{ hash: gitHash.slice(0, 7), author: "", message: "A new version is available." }];
    }
}

async function fetchUpdates() {
    // Check for updates via the release download CDN (version.txt) instead of the GitHub REST API,
    // so update checks are NOT subject to the 60 requests/hour unauthenticated API rate limit.
    const remoteHash = (await fetchBuffer(`${RELEASE_DOWNLOAD_BASE}/version.txt`)).toString("utf-8").trim();

    if (!remoteHash || remoteHash === gitHash)
        return false;

    PendingUpdate = `${RELEASE_DOWNLOAD_BASE}/${ASAR_FILE}`;

    return true;
}

// CI publishes a `<asar>.sha256` asset next to each build. Releases from before that have no
// checksum, so a missing file skips verification instead of failing the update.
async function fetchExpectedHash() {
    try {
        const hash = (await fetchBuffer(`${RELEASE_DOWNLOAD_BASE}/${ASAR_FILE}.sha256`)).toString("utf-8").trim().toLowerCase();
        return /^[0-9a-f]{64}$/.test(hash) ? hash : null;
    } catch {
        return null;
    }
}

async function applyUpdates() {
    if (!PendingUpdate) return true;

    const [data, expectedHash] = await Promise.all([fetchBuffer(PendingUpdate), fetchExpectedHash()]);

    // Catches corrupted/truncated downloads and the brief window where the rolling release's
    // assets are mid-republish, so a bad build never overwrites the working install.
    if (expectedHash) {
        const actualHash = createHash("sha256").update(data).digest("hex");
        if (actualHash !== expectedHash)
            throw new Error("The update download failed verification (checksum mismatch). A new release may be publishing right now - please try again in a few minutes.");
    }

    writeFileSync(__dirname, data, { flush: true });

    PendingUpdate = null;

    return true;
}

ipcMain.handle(IpcEvents.GET_REPO, serializeErrors(() => `https://github.com/${gitRemote}`));
ipcMain.handle(IpcEvents.GET_UPDATES, serializeErrors(calculateGitChanges));
ipcMain.handle(IpcEvents.UPDATE, serializeErrors(fetchUpdates));
ipcMain.handle(IpcEvents.BUILD, serializeErrors(applyUpdates));
