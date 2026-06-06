/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface AvatarDecorationData {
    asset: string;
    skuId: string;
}

export interface CustomStatus {
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
}

export interface DisplayNameStyles {
    font_id: number;
    effect_id: number;
    colors: number[];
}

export interface Nameplate {
    skuId: string;
    asset: string;
    label?: string;
    palette?: string;
    type: number;
}

export interface ProfileEffect {
    skuId: string;
    title?: string;
    description?: string;
    accessibilityLabel?: string;
    reducedMotionSrc?: string;
    thumbnailPreviewSrc?: string;
    effects?: any[];
    animationType?: any;
    staticFrameSrc?: string;
    type: number;
}

export interface ProfilePreset {
    name: string;
    timestamp: number;
    avatarDataUrl: string | null;
    bannerDataUrl: string | null;
    bio: string | null;
    accentColor: number | null;
    themeColors: number[] | null;
    globalName: string | null;
    pronouns: string | null;
    avatarDecoration: AvatarDecorationData | null;
    profileEffect: ProfileEffect | null;
    nameplate: Nameplate | null;
    primaryGuildId: string | null;
    customStatus: CustomStatus | null;
    displayNameStyles: DisplayNameStyles | null;
}
