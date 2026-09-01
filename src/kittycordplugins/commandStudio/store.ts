/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

const USAGE_KEY = "CommandStudio_Usage";
const FILES_KEY = "CommandStudio_Files";

export const MAX_FILE_BYTES = 8_000_000;
export const MAX_FILES = 20;

export interface StoredFile {
    id: string;
    name: string;
    type: string;
    data: string;
}

let usage: Record<string, number> = {};
let files: Record<string, StoredFile> = {};

export async function loadStore() {
    usage = (await get<Record<string, number>>(USAGE_KEY)) ?? {};
    files = (await get<Record<string, StoredFile>>(FILES_KEY)) ?? {};
}

export function useCount(trigger: string) {
    return usage[trigger.toLowerCase()] ?? 0;
}

export function bumpUse(trigger: string) {
    const key = trigger.toLowerCase();
    usage[key] = (usage[key] ?? 0) + 1;
    set(USAGE_KEY, usage);
    return usage[key];
}

export function forgetUse(trigger: string) {
    delete usage[trigger.toLowerCase()];
    set(USAGE_KEY, usage);
}

export function getFile(id: string) {
    return files[id];
}

export function listFiles() {
    return Object.values(files);
}

export async function addFile(file: File): Promise<StoredFile | { error: string; }> {
    if (file.size > MAX_FILE_BYTES) return { error: "That file is larger than 8 MB." };
    if (Object.keys(files).length >= MAX_FILES) return { error: `You can keep at most ${MAX_FILES} files.` };

    const buffer = new Uint8Array(await file.arrayBuffer());
    let binary = "";
    for (const byte of buffer) binary += String.fromCharCode(byte);

    const stored: StoredFile = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: file.type || "application/octet-stream",
        data: btoa(binary)
    };

    files = { ...files, [stored.id]: stored };
    await set(FILES_KEY, files);
    return stored;
}

export async function removeFile(id: string) {
    const next = { ...files };
    delete next[id];
    files = next;
    await set(FILES_KEY, files);
}

export function toFile(stored: StoredFile): File {
    const binary = atob(stored.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], stored.name, { type: stored.type });
}
