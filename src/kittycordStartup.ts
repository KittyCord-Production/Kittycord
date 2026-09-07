/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get as dsGet, set as dsSet } from "@api/DataStore";
import { popNotice, showNotice } from "@api/Notices";
import { isPluginEnabled } from "@api/PluginManager";
import { Settings, SettingsStore } from "@api/Settings";
import { coreStyleRootNode } from "@api/Styles";
import { ChangelogTab, openSettingsTabModal } from "@components/settings";
import { markUpdateNoticeShown, shouldSurfaceUpdateNotice } from "@components/settings/tabs/changelog/changelogManager";
import { ACCENT_PRESETS } from "@shared/accentPresets";
import { createAndAppendStyle } from "@utils/css";
import { UpdateLogger } from "@utils/updater";
import { patchResilience } from "@webpack/patcher";

const PERFORMANCE_SUGGESTION_KEY = "Kittycord_PerformanceSuggested";

export function applyAccent() {
    const preset = ACCENT_PRESETS[Settings.kittycordAccent] ?? ACCENT_PRESETS.pink;
    accentStyleNode.textContent = `:root{--kc-accent:${preset.accent};--kc-accent-soft:${preset.soft};--kc-accent-glow:${preset.glow};--kc-logo-filter:${preset.logoFilter}}`;
}

let accentStyleNode: HTMLStyleElement;

export function initKittycordStyles() {
    accentStyleNode = createAndAppendStyle("vencord-kittycord-accent", coreStyleRootNode);
    applyAccent();
    SettingsStore.addChangeListener("kittycordAccent", applyAccent);
}

async function maybeSurfaceChangelog() {
    try {
        if (!await shouldSurfaceUpdateNotice()) return;
        await markUpdateNoticeShown();
        showNotice(
            "You're on a new version of Kittycord!",
            "What's New",
            () => { if (ChangelogTab) openSettingsTabModal(ChangelogTab); }
        );
    } catch (err) {
        UpdateLogger.error("Failed to surface changelog notice", err);
    }
}

function maybeWarnPatchFailures() {
    const { erroredPatches, noEffectPatches } = patchResilience;
    if (erroredPatches < 3 && noEffectPatches < 8) return;

    showNotice(
        "Some Kittycord features couldn't load, likely because Discord updated. The basics still work, and a Kittycord update usually fixes it.",
        "OK",
        popNotice
    );
}

async function maybeSuggestPerformanceMode() {
    try {
        if (isPluginEnabled("PerformanceMode")) return;

        const cores = navigator.hardwareConcurrency || 8;
        const memory = (navigator as { deviceMemory?: number; }).deviceMemory ?? 8;
        if (cores > 4 && memory > 4) return;

        if (await dsGet(PERFORMANCE_SUGGESTION_KEY)) return;
        await dsSet(PERFORMANCE_SUGGESTION_KEY, true);

        showNotice(
            "This device looks low on power. Turn on PerformanceMode in Kittycord settings for a lighter, smoother Discord.",
            "OK",
            popNotice
        );
    } catch (err) {
        UpdateLogger.error("Failed to run performance auto-detect", err);
    }
}

export function scheduleKittycordNotices() {
    if (IS_DEV) return;

    setTimeout(maybeSurfaceChangelog, 6000);
    if (!IS_REPORTER) setTimeout(maybeWarnPatchFailures, 10_000);
    setTimeout(maybeSuggestPerformanceMode, 14_000);
}
