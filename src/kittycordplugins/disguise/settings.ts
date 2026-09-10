/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

import { DisguiseList } from "./DisguiseList";

export interface Disguise {
    templateId: string;
    username: string;
    globalName: string | undefined;
    discriminator: string;
    avatar: string;
    banner: string | null | undefined;
}

export const settings = definePluginSettings({
    disguises: {
        type: OptionType.CUSTOM,
        description: "",
        default: {} as Record<string, Disguise>
    },
    disguiseList: {
        type: OptionType.COMPONENT,
        component: DisguiseList
    }
});

export function getDisguise(userId: string): Disguise | undefined {
    return settings.plain.disguises?.[userId];
}

export function setDisguise(userId: string, disguise: Disguise) {
    settings.store.disguises = { ...settings.store.disguises, [userId]: disguise };
}

export function removeDisguise(userId: string) {
    const { [userId]: _removed, ...rest } = settings.store.disguises;
    settings.store.disguises = rest;
}
