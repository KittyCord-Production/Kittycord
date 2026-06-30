/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

export type PetProfile = "cat" | "ghost" | "teddy" | "raccoon";

const KEYS: Record<PetProfile, string> = {
    cat: "Kittycord_KittyPet",
    ghost: "Kittycord_KittyGhost",
    teddy: "Kittycord_KittyTeddy",
    raccoon: "Kittycord_KittyRaccoon"
};

export interface PetSave {
    xp: number;
    pets: number;
    equipped: string | null;
    msgDay: string;
    msgXp: number;
    notifiedLevel: number;
    name: string;
    tint: string;
    aura: string;
    lastPetDay: string;
    streak: number;
    playDay: string;
    playXp: number;
}

export const LEVEL_XP = [0, 40, 120, 280, 520, 850, 1300, 1880, 2600, 3500];
export const MAX_LEVEL = LEVEL_XP.length;
export const DAILY_MSG_XP_CAP = 30;
export const DAILY_PET_XP = 12;
export const DAILY_PLAY_XP_CAP = 10;
export const PLAY_XP = 3;

export function levelFor(xp: number): number {
    let level = 1;
    for (let i = 0; i < LEVEL_XP.length; i++) {
        if (xp >= LEVEL_XP[i]) level = i + 1;
    }
    return level;
}

export function nextLevelXp(level: number): number | null {
    return level >= MAX_LEVEL ? null : LEVEL_XP[level];
}

const defaults = (): PetSave => ({ xp: 0, pets: 0, equipped: null, msgDay: "", msgXp: 0, notifiedLevel: 1, name: "", tint: "pink", aura: "pink", lastPetDay: "", streak: 0, playDay: "", playXp: 0 });

const saves: Record<PetProfile, PetSave> = { cat: defaults(), ghost: defaults(), teddy: defaults(), raccoon: defaults() };
let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(fn, fn);
    writeQueue = result.then(() => {}, () => {});
    return result;
}

export async function loadSave(profile: PetProfile): Promise<PetSave> {
    const stored = await get<Partial<PetSave>>(KEYS[profile]);
    saves[profile] = { ...defaults(), ...stored };
    if (stored?.notifiedLevel === undefined) saves[profile].notifiedLevel = levelFor(saves[profile].xp);
    return saves[profile];
}

export const getSave = (profile: PetProfile) => saves[profile];

export function updateSave(profile: PetProfile, patch: Partial<PetSave>): Promise<PetSave> {
    return enqueue(async () => {
        saves[profile] = { ...saves[profile], ...patch };
        await set(KEYS[profile], saves[profile]);
        return saves[profile];
    });
}

function withXp(save: PetSave, amount: number, extra?: Partial<PetSave>): { save: PetSave; leveled: number | null; } {
    const before = levelFor(save.xp);
    const xp = save.xp + amount;
    const after = levelFor(xp);
    const leveled = after > before && after > save.notifiedLevel ? after : null;
    return { save: { ...save, ...extra, xp, notifiedLevel: leveled ?? save.notifiedLevel }, leveled };
}

export function addXp(profile: PetProfile, amount: number): Promise<number | null> {
    return enqueue(async () => {
        const { save, leveled } = withXp(saves[profile], amount);
        saves[profile] = save;
        await set(KEYS[profile], saves[profile]);
        return leveled;
    });
}

export function grantPlayXp(profile: PetProfile): Promise<number | null> {
    return enqueue(async () => {
        const today = new Date().toDateString();
        const cur = saves[profile];
        const spent = cur.playDay === today ? cur.playXp : 0;
        if (spent >= DAILY_PLAY_XP_CAP) return null;
        const grant = Math.min(PLAY_XP, DAILY_PLAY_XP_CAP - spent);
        const { save, leveled } = withXp(cur, grant, { playDay: today, playXp: spent + grant });
        saves[profile] = save;
        await set(KEYS[profile], saves[profile]);
        return leveled;
    });
}
