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

import { DATA_DIR } from "@main/utils/constants";
import { IpcEvents } from "@shared/IpcEvents";
import { ipcMain } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const ASAR_FILE = IS_VESKTOP ? "vesktop.asar" : IS_EQUIBOP ? "equibop.asar" : "desktop.asar";

export interface StoredChangelog {
    hash: string;
    generatedAt: number;
    entries: string[];
}

const CHANGELOG_FILE = join(DATA_DIR, "changelog.json");

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(entry => typeof entry === "string");
}

function parseChangelog(raw: string): StoredChangelog | null {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;

    const { hash, generatedAt, entries } = data as Record<string, unknown>;
    if (typeof hash !== "string" || typeof generatedAt !== "number" || !isStringArray(entries)) return null;

    return { hash, generatedAt, entries };
}

export function storeChangelog(raw: string) {
    const changelog = parseChangelog(raw);
    if (!changelog) return;

    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CHANGELOG_FILE, JSON.stringify(changelog), "utf-8");
}

function readChangelog(): StoredChangelog | null {
    try {
        return parseChangelog(readFileSync(CHANGELOG_FILE, "utf-8"));
    } catch {
        return null;
    }
}

ipcMain.handle(IpcEvents.GET_LAST_CHANGELOG, () => readChangelog());

export function serializeErrors(func: (...args: any[]) => any) {
    return async function () {
        try {
            return {
                ok: true,
                value: await func(...arguments)
            };
        } catch (e: any) {
            return {
                ok: false,
                error: e instanceof Error ? {
                    // prototypes get lost, so turn error into plain object
                    ...e,
                    message: e.message,
                    name: e.name,
                    stack: e.stack
                } : e
            };
        }
    };
}
