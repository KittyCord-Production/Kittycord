/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled, plugins, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { EyeIcon } from "@components/Icons";
import { openSettingsTabModal } from "@components/settings";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { Select, Text, TextInput } from "@webpack/common";

const WATCHED = ["plugins.*"] as const;

interface Preset {
    id: string;
    label: string;
    description: string;
    apply(): void;
}

function setPluginEnabled(name: string, value: boolean) {
    const plugin = plugins[name];
    if (!plugin) return;
    Settings.plugins[name].enabled = value;
    try {
        if (value) startPlugin(plugin);
        else stopPlugin(plugin);
    } catch { }
}

function PluginSwitch({ plugin, setting, title, description }: {
    plugin: string;
    setting: string;
    title: string;
    description: string;
}) {
    if (!plugins[plugin]) return null;

    const store = Settings.plugins[plugin];
    const enabled = isPluginEnabled(plugin);

    return (
        <FormSwitch
            title={title}
            description={enabled ? description : `${description} Turning this on also switches ${plugin} on.`}
            value={enabled && store[setting] === true}
            onChange={value => {
                if (value && !enabled) setPluginEnabled(plugin, true);
                store[setting] = value;
            }}
            hideBorder
        />
    );
}

const PRESETS: Preset[] = [
    {
        id: "calm",
        label: "Calm",
        description: "Nothing moves, nothing glows, quiet hours on overnight.",
        apply() {
            setPluginEnabled("PerformanceMode", true);
            Object.assign(Settings.plugins.PerformanceMode, {
                noAnimations: true,
                followSystemReducedMotion: true,
                noBlur: true,
                hideProfileEffects: true,
                hideAvatarDecorations: true,
                hideNameplates: true
            });
            setPluginEnabled("KittyMotion", false);
            setPluginEnabled("QuietHours", true);
            setPluginEnabled("Wellbeing", true);
            Settings.plugins.Wellbeing.breakReminders = true;
        }
    },
    {
        id: "focus",
        label: "Focus",
        description: "Decorations and effects out of the way, animations stay.",
        apply() {
            setPluginEnabled("PerformanceMode", true);
            Object.assign(Settings.plugins.PerformanceMode, {
                noAnimations: false,
                followSystemReducedMotion: true,
                noBlur: false,
                hideProfileEffects: true,
                hideAvatarDecorations: true,
                hideNameplates: true
            });
            setPluginEnabled("Wellbeing", true);
            Settings.plugins.Wellbeing.breakReminders = true;
        }
    },
    {
        id: "lively",
        label: "Lively",
        description: "Everything on, the way Discord looks by default.",
        apply() {
            Object.assign(Settings.plugins.PerformanceMode, {
                ultra: false,
                noAnimations: false,
                followSystemReducedMotion: true,
                noBlur: false,
                hideProfileEffects: false,
                hideAvatarDecorations: false,
                hideNameplates: false
            });
            setPluginEnabled("QuietHours", false);
        }
    }
];

function QuietHoursRow() {
    if (!plugins.QuietHours) return null;

    const enabled = isPluginEnabled("QuietHours");
    const store = Settings.plugins.QuietHours;

    return (
        <>
            <FormSwitch
                title="Quiet hours"
                description="Sets your status automatically overnight so late pings stop reaching you."
                value={enabled}
                onChange={v => setPluginEnabled("QuietHours", v)}
                hideBorder
            />
            {enabled && (
                <div className="kc-comfort-times">
                    <label>
                        <Text variant="text-sm/normal">From</Text>
                        <TextInput value={store.startTime} onChange={v => store.startTime = v} placeholder="23:00" />
                    </label>
                    <label>
                        <Text variant="text-sm/normal">Until</Text>
                        <TextInput value={store.endTime} onChange={v => store.endTime = v} placeholder="08:00" />
                    </label>
                </div>
            )}
        </>
    );
}

function BreaksRow() {
    if (!plugins.Wellbeing) return null;

    const enabled = isPluginEnabled("Wellbeing");
    const store = Settings.plugins.Wellbeing;
    const on = enabled && store.breakReminders === true;

    return (
        <>
            <FormSwitch
                title="Break reminders"
                description="A gentle nudge after a long stretch, with a one-tap break that sets you to Do Not Disturb."
                value={on}
                onChange={value => {
                    if (value && !enabled) setPluginEnabled("Wellbeing", true);
                    store.breakReminders = value;
                }}
                hideBorder
            />
            {on && (
                <div className="kc-comfort-select">
                    <Text variant="text-sm/normal">Remind me after</Text>
                    <Select
                        options={[45, 60, 90, 120].map(m => ({ label: `${m} minutes`, value: m }))}
                        select={v => store.breakInterval = v}
                        isSelected={v => store.breakInterval === v}
                        serialize={String}
                    />
                </div>
            )}
        </>
    );
}

function ComfortTab() {
    useSettings(WATCHED as unknown as Parameters<typeof useSettings>[0]);

    return (
        <ErrorBoundary noop>
            <div className="kc-comfort">
                <Text variant="heading-lg/semibold">Comfort</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6 }}>
                    Everything that makes Discord calmer, in one place. These are the same switches as in the plugins
                    they belong to, so changing them here changes them there.
                </Text>

                <div className="kc-comfort-presets">
                    {PRESETS.map(preset => (
                        <Button key={preset.id} variant="secondary" onClick={preset.apply}>{preset.label}</Button>
                    ))}
                </div>
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>
                    {PRESETS.map(p => `${p.label}: ${p.description}`).join(" ")}
                </Text>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Movement</Text>
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="noAnimations"
                    title="Stop UI animations"
                    description="Menus, popouts and switching channels happen instantly instead of sliding."
                />
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="followSystemReducedMotion"
                    title="Follow my system's reduce-motion setting"
                    description="If your operating system asks for less motion, Kittycord listens without you doing anything."
                />
                <PluginSwitch
                    plugin="KittyMotion"
                    setting="respectReducedMotion"
                    title="Keep Kittycord's own animations off too"
                    description="Applies the same rule to the extra transitions KittyMotion adds."
                />

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>A quieter picture</Text>
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="noBlur"
                    title="No background blur"
                    description="Removes the frosted-glass effect behind popouts and modals."
                />
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="hideProfileEffects"
                    title="Hide animated profile effects"
                    description="The moving backgrounds some people have on their profile stop playing."
                />
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="hideAvatarDecorations"
                    title="Hide avatar decorations"
                    description="The frames around avatars are hidden everywhere."
                />
                <PluginSwitch
                    plugin="PerformanceMode"
                    setting="hideNameplates"
                    title="Hide nameplates"
                    description="The coloured plates behind names in the member list are hidden."
                />

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>When people reach you</Text>
                <QuietHoursRow />
                <BreaksRow />

                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 20 }}>
                    Looking for the rest? Every switch here also lives in its own plugin, with more options.
                </Text>
            </div>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "Comfort",
    description: "One calm place for the settings that decide how loud, busy and bright Discord feels.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: true,

    toolboxActions: {
        "Open Comfort"() {
            openSettingsTabModal(ComfortTab);
        }
    },

    start() {
        SettingsPlugin.customEntries.push({
            key: "kittycord_comfort",
            title: "Comfort",
            panelTitle: "Comfort",
            Component: ComfortTab,
            Icon: EyeIcon,
            pinned: true
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_comfort");
    }
});
