/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";

const KEY = "Kittycord_KittyPet";

export interface PetSave {
    xp: number;
    pets: number;
    equipped: string | null;
    msgDay: string;
    msgXp: number;
}

export const LEVEL_XP = [0, 40, 120, 280, 600];
export const MAX_LEVEL = LEVEL_XP.length;
export const DAILY_MSG_XP_CAP = 30;

export const ACCESSORY_LEVELS: Record<string, number> = {
    bow: 2,
    scarf: 3,
    hat: 4,
    crown: 5
};

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

export function unlockedAt(level: number): string[] {
    return Object.entries(ACCESSORY_LEVELS).filter(([, l]) => level >= l).map(([id]) => id);
}

const defaults = (): PetSave => ({ xp: 0, pets: 0, equipped: null, msgDay: "", msgXp: 0 });

let save: PetSave = defaults();

export async function loadSave(): Promise<PetSave> {
    const stored = await get<Partial<PetSave>>(KEY);
    save = { ...defaults(), ...stored };
    return save;
}

export const getSave = () => save;

export async function updateSave(patch: Partial<PetSave>): Promise<PetSave> {
    save = { ...save, ...patch };
    await set(KEY, save);
    return save;
}
