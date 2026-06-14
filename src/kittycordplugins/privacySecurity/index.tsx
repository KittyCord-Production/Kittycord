/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { FormSwitch } from "@components/FormSwitch";
import { ShieldIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { Button, React, Text } from "@webpack/common";

import style from "./style.css?managed";

const REPO = "https://github.com/KittyCord-Production/Kittycord";
const open = (url: string) => VencordNative.native.openExternal(url);

interface ConsentBridge {
    getConsent: () => Promise<{ consent: boolean | null; endpointConfigured: boolean; }>;
    setConsent: (v: boolean) => Promise<void>;
}

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

function PrivacyTab() {
    return (
        <ErrorBoundary noop>
            <div className="kc-priv">
                <Text variant="heading-lg/semibold">Is Kittycord safe? 🐱</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6 }}>
                    Yes — and you don't have to take our word for it. Kittycord is fully open source. It <b>never reads your Discord login token</b>, <b>never logs your keystrokes</b> and <b>never collects your messages</b>. Every line is public, so anyone can check.
                </Text>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Verify it yourself</Text>
                <div className="kc-priv-btns">
                    <Button onClick={() => open(REPO)}>Read the source code</Button>
                    <Button color={Button.Colors.PRIMARY} onClick={() => open(`${REPO}/actions`)}>See how it's built</Button>
                    <Button color={Button.Colors.PRIMARY} onClick={() => open(`${REPO}/releases/latest`)}>Check your download</Button>
                </div>
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 8 }}>
                    The installer is built automatically from this exact source by GitHub — nothing is added behind the scenes. Compare the published SHA-256 checksum with your download to be 100% sure.
                </Text>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>What leaves your computer</Text>
                <div className="kc-priv-yes">✅ Only if you turn it on: an anonymous install ID + version, plus any public cosmetics you choose to show (name color, avatar decoration, creator code).</div>
                <div className="kc-priv-no">❌ Never: your login token, your password, your keystrokes, your messages, or your IP address.</div>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Your data, your choice</Text>
                <ConsentToggle
                    bridge={VencordNative.kittycordTelemetry}
                    title="Share anonymous usage stats"
                    description="Sends only a random install ID + version, at most once a day, so Kittycord can count active installs. No account, no messages, no personal data."
                />
                <ConsentToggle
                    bridge={VencordNative.kittycordShare}
                    title="Let friends find you on Kittycord"
                    description="Stores only a scrambled, one-way hash of your Discord ID so friends who also use Kittycord can find each other. Off unless you enable it."
                />

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Why your antivirus might warn</Text>
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>
                    The installer isn't code-signed yet and it modifies the Discord app — both trip generic antivirus heuristics, which flag almost every Discord client mod the same way. It's a false alarm; use the links above to verify exactly what runs on your PC.
                </Text>

                <div className="kc-priv-report">
                    <Text variant="text-sm/normal">Found something concerning? Please tell us:</Text>
                    <Button color={Button.Colors.PRIMARY} onClick={() => open(`${REPO}/issues`)}>Report a security concern</Button>
                </div>
            </div>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "PrivacySecurity",
    description: "A clear, in-app overview of exactly what Kittycord does and doesn't do with your data — with links to verify it yourself.",
    authors: [{ name: "Kittycord", id: 0n }],
    enabledByDefault: true,

    start() {
        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "kittycord_privacy",
            title: "Privacy & Security",
            panelTitle: "Privacy & Security",
            Component: PrivacyTab,
            Icon: ShieldIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_privacy");
        disableStyle(style);
    }
});
