/*!
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

// DO NOT REMOVE UNLESS YOU WISH TO FACE THE WRATH OF THE CIRCULAR DEPENDENCY DEMON!!!!!!!
import "~plugins";
import "./fixWeirdAppRegionBug.css";

export * as Api from "./api";
export * as Plugins from "./api/PluginManager";
export * as Components from "./components";
export * as Util from "./utils";
export * as Updater from "./utils/updater";
export * as Webpack from "./webpack";
export * as WebpackPatcher from "./webpack/patchWebpack";
export { PlainSettings, Settings };

import { coreStyleRootNode, initStyles } from "@api/Styles";
import { ChangelogTab, openSettingsTabModal, UpdaterTab } from "@components/settings";
import { markUpdateNoticeShown, shouldSurfaceUpdateNotice } from "@components/settings/tabs/changelog/changelogManager";
import { ACCENT_PRESETS } from "@shared/accentPresets";
import { debounce } from "@shared/debounce";
import { IS_WINDOWS } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { StartAt } from "@utils/types";
import { SettingsRouter, showToast, Toasts } from "@webpack/common";

import { get as dsGet, set as dsSet } from "./api/DataStore";
import { popNotice, showNotice } from "./api/Notices";
import { NotificationData, showNotification } from "./api/Notifications";
import { initPluginManager, isPluginEnabled, PMLogger, startAllPlugins } from "./api/PluginManager";
import { PlainSettings, Settings, SettingsStore } from "./api/Settings";
import { areLocalSettingsDirty, getCloudSettings, getCloudSyncDirection, markLocalSettingsDirty, putCloudSettings, shouldCloudSync } from "./api/SettingsSync/cloudSync";
import { relaunch } from "./utils/native";
import { checkForUpdates, isOutdated as getIsOutdated, update, UpdateLogger } from "./utils/updater";
import { onceReady } from "./webpack";
import { patches, patchResilience } from "./webpack/patchWebpack";

if (IS_REPORTER) {
    require("./debug/runReporter");
}

async function syncSettings() {
    const hasCloudAuth = await dsGet("Vencord_cloudSecret");
    if (!hasCloudAuth) {
        if (Settings.cloud.authenticated) {
            // User switched to an account that isn't connected to cloud
            showNotification({
                title: "Cloud Settings",
                body: "Cloud sync was disabled because this account isn't connected to the cloud App. You can enable it again by connecting this account in Cloud Settings. (note: it will store your preferences separately)",
                color: "var(--yellow-360)",
                onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
            });
            // Disable cloud sync globally
            Settings.cloud.authenticated = false;
        }
        return;
    }

    // pre-check for local shared settings
    if (
        Settings.cloud.authenticated &&
        !hasCloudAuth // this has been enabled due to local settings share or some other bug
    ) {
        // show a notification letting them know and tell them how to fix it
        showNotification({
            title: "Cloud Integrations",
            body: "We've noticed you have cloud integrations enabled in another client! Due to limitations, you will " +
                "need to re-authenticate to continue using them. Click here to go to the settings page to do so!",
            color: "var(--yellow-360)",
            onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
        });
        return;
    }

    if (
        Settings.cloud.settingsSync && // if it's enabled
        Settings.cloud.authenticated && // if cloud integrations are enabled
        getCloudSyncDirection() !== "manual" // if we're not in manual mode
    ) {
        if (areLocalSettingsDirty() && shouldCloudSync("push")) {
            await putCloudSettings();
        } else if (shouldCloudSync("pull") && await getCloudSettings(false)) { // if we synchronized something (false means no sync)
            // we show a notification here instead of allowing getCloudSettings() to show one to declutter the amount of
            // potential notifications that might occur. getCloudSettings() will always send a notification regardless if
            // there was an error to notify the user, but besides that we only want to show one notification instead of all
            // of the possible ones it has (such as when your settings are newer).
            showNotification({
                title: "Cloud Settings",
                body: "Your settings have been updated! Click here to restart to fully apply changes!",
                color: "var(--green-360)",
                onClick: relaunch
            });
        }
    }

    const saveSettingsOnFrequentAction = debounce(async () => {
        if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
            await putCloudSettings();
        }
    }, 60_000);

    SettingsStore.addGlobalChangeListener(() => {
        markLocalSettingsDirty();
        saveSettingsOnFrequentAction();
    });
}

let notifiedForUpdatesThisSession = false;

async function updateAndRelaunch() {
    showToast("Getting the latest Kittycord update…", Toasts.Type.MESSAGE);
    try {
        if (await checkForUpdates()) await update();
    } catch (err) {
        UpdateLogger.error("Failed to pull the latest update before restarting", err);
    }
    relaunch();
}

async function runUpdateCheck() {
    if (IS_UPDATER_DISABLED) return;
    // Once we've notified (or auto-updated + notified) this session, stop re-checking, so the periodic
    // re-check below never re-downloads the asar or shows the notice twice.
    if (notifiedForUpdatesThisSession) return;

    const notify = (data: NotificationData) => {
        if (notifiedForUpdatesThisSession) return;
        notifiedForUpdatesThisSession = true;

        setTimeout(() => showNotification({
            permanent: true,
            noPersist: true,
            ...data
        }), 10_000);
    };

    try {
        const isOutdated = await checkForUpdates();
        if (IS_DISCORD_DESKTOP) VencordNative.tray.setUpdateState(isOutdated);
        if (!isOutdated) return;

        if (Settings.autoUpdate) {
            await update();
            if (Settings.autoUpdateNotification) {
                if (notifiedForUpdatesThisSession) return;
                notifiedForUpdatesThisSession = true;

                showNotice(
                    "Kittycord has been updated!",
                    "Restart",
                    updateAndRelaunch
                );
            }
            return;
        }

        if (notifiedForUpdatesThisSession) return;
        notifiedForUpdatesThisSession = true;

        showNotice(
            "A new version of Kittycord is available!",
            "View Update",
            () => openSettingsTabModal(UpdaterTab!)
        );
    } catch (err) {
        UpdateLogger.error("Failed to check for updates", err);
    }
}

function initTrayIpc() {
    if (IS_WEB || IS_UPDATER_DISABLED) return;

    VencordNative.tray.onCheckUpdates(async () => {
        try {
            const isOutdated = await checkForUpdates();
            VencordNative.tray.setUpdateState(isOutdated);

            if (isOutdated) {
                showNotice("A Kittycord update is available!", "View Update", () => openSettingsTabModal(UpdaterTab!));
            } else {
                showNotice("No updates available, you're on the latest version!", "OK", popNotice);
            }
        } catch (err) {
            UpdateLogger.error("Failed to check for updates from tray", err);
            showNotice("Failed to check for updates, check the console for more info", "OK", popNotice);
        }
    });

    VencordNative.tray.onRepair(async () => {
        try {
            await VencordNative.tray.repairHost();
            await update();
            relaunch();
        } catch (err) {
            UpdateLogger.error("Failed to repair Kittycord", err);
        }
    });

    VencordNative.tray.setUpdateState(getIsOutdated);
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

const PERFORMANCE_SUGGESTION_KEY = "Kittycord_PerformanceSuggested";

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

async function init() {
    await onceReady;
    startAllPlugins(StartAt.WebpackReady);

    syncSettings();
    initTrayIpc();

    if (!IS_DEV && !IS_WEB && !IS_UPDATER_DISABLED) {
        runUpdateCheck();

        // Re-check periodically so a long-running client still notices new releases without a restart.
        // runUpdateCheck() bails out after it has notified once this session, so this never spams.
        setInterval(runUpdateCheck, 1000 * 60 * 30); // 30 minutes
    }

    if (!IS_DEV) setTimeout(maybeSurfaceChangelog, 6000);

    if (!IS_DEV && !IS_REPORTER) setTimeout(maybeWarnPatchFailures, 10_000);

    if (!IS_DEV) setTimeout(maybeSuggestPerformanceMode, 14_000);

    if (IS_DEV) {
        const pendingPatches = patches.filter(p => !p.all && p.predicate?.() !== false);
        if (pendingPatches.length)
            PMLogger.warn(
                "Webpack has finished initialising, but some patches haven't been applied yet.",
                "This might be expected since some Modules are lazy loaded, but please verify",
                "that all plugins are working as intended.",
                "You are seeing this warning because this is a Development build of Kittycord.",
                "\nThe following patches have not been applied:",
                "\n\n" + pendingPatches.map(p => `${p.plugin}: ${p.find}`).join("\n")
            );
    }
}

initPluginManager();
initStyles();

const accentStyleNode = createAndAppendStyle("vencord-kittycord-accent", coreStyleRootNode);
function applyAccent() {
    const preset = ACCENT_PRESETS[Settings.kittycordAccent] ?? ACCENT_PRESETS.pink;
    accentStyleNode.textContent = `:root{--kc-accent:${preset.accent};--kc-accent-soft:${preset.soft};--kc-accent-glow:${preset.glow};--kc-logo-filter:${preset.logoFilter}}`;
}
applyAccent();
SettingsStore.addChangeListener("kittycordAccent", applyAccent);

startAllPlugins(StartAt.Init);
init();

document.addEventListener("DOMContentLoaded", () => {
    startAllPlugins(StartAt.DOMContentLoaded);

    // FIXME
    if (IS_DISCORD_DESKTOP && Settings.winNativeTitleBar && IS_WINDOWS) {
        createAndAppendStyle("vencord-native-titlebar-style", coreStyleRootNode).textContent = "[class*=titleBar]{display: none!important}";
    }
}, { once: true });
