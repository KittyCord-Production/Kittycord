/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { isPluginEnabled, plugins, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { SafetyIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { Button, React, Text } from "@webpack/common";

import style from "./style.css?managed";

const WELLBEING_KEY = "Kittycord_Wellbeing";
const CHECKLIST_KEY = "Kittycord_SafetyChecklist";
const TWO_FA_HELP = "https://support.discord.com/hc/en-us/articles/219576828-Setting-up-Two-Factor-Authentication";

const open = (url: string) => VencordNative.native.openExternal(url);

interface ConsentBridge {
    getConsent: () => Promise<{ consent: boolean | null; endpointConfigured: boolean; }>;
    setConsent: (v: boolean) => Promise<void>;
}

const CHECKLIST = [
    { id: "2fa", label: "Turn on two-factor authentication (2FA)", hint: "The single biggest thing you can do to protect your account." },
    { id: "token", label: "Never paste code into the console or share your token", hint: "No real tool or person ever needs it — it's a full key to your account." },
    { id: "password", label: "Use a strong, unique password", hint: "A password manager makes this effortless." },
    { id: "apps", label: "Review your authorised apps", hint: "Remove anything you don't recognise in User Settings → Authorised Apps." },
    { id: "devices", label: "Check your active devices and sessions", hint: "Log out anything that isn't you." },
    { id: "scams", label: "Ignore “free Nitro” links and QR-code logins", hint: "Scanning a login QR for someone hands them your account." }
];

function ConsentToggle({ bridge, title, description }: { bridge: ConsentBridge; title: string; description: string; }) {
    const [consent, setConsent] = React.useState<boolean | null>(null);
    React.useEffect(() => { bridge.getConsent().then(s => setConsent(s.consent)).catch(() => { }); }, []);
    return (
        <FormSwitch
            title={title}
            description={description}
            value={consent === true}
            onChange={v => { setConsent(v); bridge.setConsent(v).catch(() => { }); }}
            hideBorder
        />
    );
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

function fmtMin(m: number) {
    if (!m) return "0m";
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
}

function SafetyTab() {
    const [checks, setChecks] = React.useState<Record<string, boolean>>({});
    const [today, setToday] = React.useState<{ activeMin: number; messages: number; } | null | undefined>(undefined);
    const [badgeOn, setBadgeOn] = React.useState(() => isPluginEnabled("UsesKittycord"));

    React.useEffect(() => {
        get<Record<string, boolean>>(CHECKLIST_KEY).then(v => setChecks(v ?? {})).catch(() => { });
        get<{ days?: Array<{ date: string; activeMin?: number; messages?: number; }>; }>(WELLBEING_KEY)
            .then(w => {
                const day = w?.days?.find(d => d.date === new Date().toDateString());
                setToday(day ? { activeMin: day.activeMin ?? 0, messages: day.messages ?? 0 } : null);
            })
            .catch(() => setToday(null));
    }, []);

    function toggleCheck(id: string, v: boolean) {
        const next = { ...checks, [id]: v };
        setChecks(next);
        set(CHECKLIST_KEY, next).catch(() => { });
    }

    const done = CHECKLIST.filter(c => checks[c.id]).length;
    const telemetry = (VencordNative as any)?.kittycordTelemetry as ConsentBridge | undefined;
    const share = (VencordNative as any)?.kittycordShare as ConsentBridge | undefined;

    return (
        <ErrorBoundary noop>
            <div className="kc-safety">
                <Text variant="heading-lg/semibold">Account safety 🐱</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6 }}>
                    A quick overview of your privacy choices and a short checklist to keep your Discord account safe. Everything here stays on your device.
                </Text>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Security checklist ({done}/{CHECKLIST.length})</Text>
                <div className="kc-safety-progress"><div className="kc-safety-bar" style={{ width: `${(done / CHECKLIST.length) * 100}%` }} /></div>
                {CHECKLIST.map(c => (
                    <FormSwitch key={c.id} title={c.label} description={c.hint} value={!!checks[c.id]} onChange={v => toggleCheck(c.id, v)} hideBorder />
                ))}
                <div className="kc-safety-btns">
                    <Button color={Button.Colors.PRIMARY} onClick={() => open(TWO_FA_HELP)}>How to turn on 2FA</Button>
                </div>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Privacy controls</Text>
                {telemetry && (
                    <ConsentToggle
                        bridge={telemetry}
                        title="Share anonymous usage stats"
                        description="Sends only a random install ID + version, at most once a day. No account, no messages, no personal data."
                    />
                )}
                {share && (
                    <ConsentToggle
                        bridge={share}
                        title="Let friends find you on Kittycord"
                        description="Stores only a scrambled, one-way hash of your Discord ID so friends who also use Kittycord can find each other."
                    />
                )}
                <FormSwitch
                    title={"Show the public “Uses Kittycord” badge"}
                    description="Adds you to the public list of Kittycord users so the cat badge shows on your profile. Turn off to stop appearing."
                    value={badgeOn}
                    onChange={v => { setBadgeOn(v); setPluginEnabled("UsesKittycord", v); }}
                    hideBorder
                />
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 8 }}>
                    Want the full breakdown of exactly what leaves your computer? Open the Privacy &amp; Security tab.
                </Text>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Today on Discord</Text>
                {today === undefined
                    ? <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>Loading…</Text>
                    : today === null
                        ? <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>Turn on the Wellbeing plugin to see your local screen-time insights here. This data never leaves your device.</Text>
                        : (
                            <div className="kc-safety-stats">
                                <div className="kc-safety-stat"><b>{fmtMin(today.activeMin)}</b><span>active today</span></div>
                                <div className="kc-safety-stat"><b>{today.messages}</b><span>messages sent</span></div>
                            </div>
                        )}
            </div>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "SafetyDashboard",
    description: "One calm place for your account safety: a security checklist, your privacy choices at a glance, and your local screen-time snapshot — all kept on your device.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    start() {
        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "kittycord_safety",
            title: "Account Safety",
            panelTitle: "Account Safety",
            Component: SafetyTab,
            Icon: SafetyIcon,
            pinned: true
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_safety");
        disableStyle(style);
    }
});
