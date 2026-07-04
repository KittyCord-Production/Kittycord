/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, pluginRequiresRestart, plugins, startPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { ShieldIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { gitHashShort } from "@shared/vencordUserAgent";
import { removeFromArray } from "@utils/misc";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin from "@utils/types";
import { checkForUpdates, update } from "@utils/updater";
import { Alerts, Button, React, showToast, Text, Toasts } from "@webpack/common";
import { getBuildNumber, patchResilience } from "@webpack/patcher";
import type { ComponentType, ReactNode } from "react";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const IS_WINDOWS_CLIENT = typeof navigator !== "undefined" && /win/i.test(navigator.platform || navigator.userAgent || "");
const canRepairHost = IS_DISCORD_DESKTOP && !IS_VESKTOP && !IS_EQUIBOP && IS_WINDOWS_CLIENT;
const canUpdate = !IS_WEB && !IS_UPDATER_DISABLED;

const WARN_COLOR = "#f0b232";

const HEAVY_THEMES = ["MonoGlass.theme.css", "Sakura.theme.css", "Midnight.theme.css", "Lavender.theme.css", "MidnightMagicGlass.theme.css"];

interface Scan {
    erroredPatches: number;
    noEffectPatches: number;
    patchesOk: boolean;
    enabledCount: number;
    failed: string[];
    discordBuild: number;
    transparencyOn: boolean;
    perfOn: boolean;
    heavyTheme: string | null;
    weakDevice: boolean;
}

function scan(): Scan {
    const { erroredPatches, noEffectPatches } = patchResilience;

    const failed: string[] = [];
    let enabledCount = 0;
    for (const p of Object.values(plugins)) {
        if (!isPluginEnabled(p.name)) continue;
        enabledCount++;
        if (!p.started && !p.required && !pluginRequiresRestart(p)) failed.push(p.name);
    }

    let discordBuild = -1;
    try { discordBuild = getBuildNumber(); } catch { /* build number unavailable */ }

    const heavyThemeFile = Settings.enabledThemes.find(t => HEAVY_THEMES.includes(t));

    return {
        erroredPatches,
        noEffectPatches,
        patchesOk: erroredPatches < 3 && noEffectPatches < 8,
        enabledCount,
        failed,
        discordBuild,
        transparencyOn: IS_DISCORD_DESKTOP && IS_WINDOWS_CLIENT && Settings.transparent === true,
        perfOn: isPluginEnabled("PerformanceMode"),
        heavyTheme: heavyThemeFile?.replace(/\.theme\.css$/, "") ?? (isPluginEnabled("HelloKittyTheme") ? "HelloKittyTheme" : null),
        weakDevice: (navigator.hardwareConcurrency || 8) <= 4 || ((navigator as { deviceMemory?: number; }).deviceMemory ?? 8) <= 4
    };
}

function StatusCard({ title, ok, children }: { title: string; ok: boolean; children: ReactNode; }) {
    return (
        <div style={{ background: "var(--background-secondary)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <Flex style={{ alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Text variant="text-md/semibold" style={{ flexGrow: 1 }}>{title}</Text>
                <Text variant="text-sm/semibold" style={{ color: ok ? "var(--text-positive)" : WARN_COLOR }}>
                    {ok ? "Healthy" : "Attention"}
                </Text>
            </Flex>
            <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>{children}</Text>
        </div>
    );
}

function DoctorPanel() {
    const [data, setData] = React.useState<Scan>(() => scan());
    const [updateState, setUpdateState] = React.useState<"idle" | "checking" | "uptodate" | "outdated" | "error">("idle");
    const [busy, setBusy] = React.useState(false);

    async function onCheckUpdates() {
        setUpdateState("checking");
        try {
            setUpdateState(await checkForUpdates() ? "outdated" : "uptodate");
        } catch {
            setUpdateState("error");
        }
    }

    async function onUpdate() {
        setBusy(true);
        try {
            await update();
            showToast("Updated — restarting to finish.", Toasts.Type.SUCCESS);
            relaunch();
        } catch {
            showToast("Update failed. Try the Updater tab.", Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    function onRepair() {
        Alerts.show({
            title: "Repair Kittycord?",
            body: "This re-applies Kittycord to your Discord and restarts it. Your plugins, themes and settings are kept.",
            confirmText: "Repair & restart",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    await VencordNative.tray?.repairHost?.();
                    try {
                        await checkForUpdates();
                        await update();
                    } catch { /* offline or nothing to update — still relaunch to apply the repair */ }
                    relaunch();
                } catch {
                    showToast("Repair failed. Try the Kittycord installer's Repair option.", Toasts.Type.FAILURE);
                }
            }
        });
    }

    function onEnablePerf() {
        const p = plugins.PerformanceMode;
        if (!p) return;
        Settings.plugins.PerformanceMode.enabled = true;
        if (startPlugin(p)) showToast("PerformanceMode is on.", Toasts.Type.SUCCESS);
        else showToast("Restart Discord to finish turning on PerformanceMode.", Toasts.Type.MESSAGE);
        setData(scan());
    }

    const perfAttention = !data.perfOn && (data.heavyTheme !== null || data.weakDevice);
    const allHealthy = data.patchesOk && data.failed.length === 0 && !data.transparencyOn && !perfAttention;

    return (
        <ErrorBoundary noop>
            <Text variant="text-md/normal" style={{ marginBottom: 12, color: "var(--text-muted)" }}>
                A quick health check for your Kittycord install. {allHealthy ? "Everything looks good." : "Something needs attention below."}
            </Text>

            <StatusCard title="Features & patches" ok={data.patchesOk}>
                {data.patchesOk
                    ? "All Kittycord features loaded normally."
                    : "Some features may not have loaded — this usually happens right after Discord updates. A repair often fixes it."}
                {!data.patchesOk && (
                    <span style={{ display: "block", marginTop: 4, opacity: 0.7 }}>
                        {data.erroredPatches} errored, {data.noEffectPatches} had no effect this session.
                    </span>
                )}
            </StatusCard>

            <StatusCard title="Plugins" ok={data.failed.length === 0}>
                {data.enabledCount} plugins enabled.
                {data.failed.length > 0 && ` ${data.failed.length} didn't start: ${data.failed.join(", ")}.`}
            </StatusCard>

            <StatusCard title="Performance" ok={!perfAttention}>
                {perfAttention
                    ? data.heavyTheme
                        ? `${data.heavyTheme} uses a glassy look that costs GPU power. PerformanceMode keeps the style but makes it much lighter.`
                        : "This device looks low on power. PerformanceMode makes Discord noticeably lighter."
                    : data.perfOn
                        ? "PerformanceMode is on and keeping things light."
                        : "No heavy themes active and your device has power to spare."}
                {perfAttention && (
                    <span style={{ display: "block", marginTop: 8 }}>
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={onEnablePerf}>
                            Turn on PerformanceMode
                        </Button>
                    </span>
                )}
            </StatusCard>

            <StatusCard title="Version" ok={updateState !== "outdated"}>
                Kittycord {gitHashShort}{data.discordBuild > 0 ? ` · Discord build ${data.discordBuild}` : ""}.
                {updateState === "checking" && " Checking for updates…"}
                {updateState === "uptodate" && " You're up to date."}
                {updateState === "outdated" && " An update is available."}
                {updateState === "error" && " Couldn't check for updates."}
            </StatusCard>

            {IS_DISCORD_DESKTOP && IS_WINDOWS_CLIENT && (
                <StatusCard title="Window behavior" ok={!data.transparencyOn}>
                    {data.transparencyOn
                        ? "Window Transparency is on, so Windows can't snap this window — dragging it to the top or pressing Win+Arrow won't maximize it. Turn off \"Enable Window Transparency\" in Kittycord settings to get snapping back. Tip: Background Material gives a glass look without this limitation."
                        : "Window snapping and drag-to-maximize work normally."}
                </StatusCard>
            )}

            <Flex style={{ gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={() => setData(scan())}>Re-scan</Button>
                {canUpdate && updateState !== "outdated" && (
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} disabled={updateState === "checking"} onClick={onCheckUpdates}>
                        Check for updates
                    </Button>
                )}
                {canUpdate && updateState === "outdated" && (
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} disabled={busy} onClick={onUpdate}>
                        Update &amp; restart
                    </Button>
                )}
                {canRepairHost && (
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={onRepair}>Repair Kittycord</Button>
                )}
            </Flex>

            {!canRepairHost && !IS_WEB && (
                <Text variant="text-xs/normal" style={{ opacity: 0.6, marginTop: 8 }}>
                    One-click repair is available on the Windows desktop app. Elsewhere, re-run the installer if features are missing.
                </Text>
            )}
        </ErrorBoundary>
    );
}

function DoctorModal({ rootProps }: { rootProps: any; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Kittycord Doctor</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <DoctorPanel />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "KittycordDoctor",
    description: "A one-tap health check that spots features broken by a Discord update and repairs your install.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    toolboxActions: {
        "Open Doctor"() {
            openModal(props => <DoctorModal rootProps={props} />);
        }
    },

    start() {
        SettingsPlugin.customEntries.push({
            key: "kittycord_doctor",
            title: "Doctor",
            panelTitle: "Kittycord Doctor",
            Component: DoctorPanel,
            Icon: ShieldIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_doctor");
    }
});
