/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { FormSwitch } from "@components/FormSwitch";
import { Paragraph } from "@components/Paragraph";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { Alerts, React } from "@webpack/common";

const Telemetry = VencordNative.kittycordTelemetry;
const logger = new Logger("UsageStats");

function ConsentSetting() {
    const [consent, setConsent] = React.useState<boolean | null>(null);
    const [configured, setConfigured] = React.useState(false);

    React.useEffect(() => {
        Telemetry.getConsent()
            .then(s => { setConsent(s.consent); setConfigured(s.endpointConfigured); })
            .catch(() => { });
    }, []);

    return (
        <>
            <FormSwitch
                title="Share anonymous usage stats"
                description="Sends only a random install ID + version, at most once a day, so Kittycord can count active installs. No account, no messages, no personal data."
                value={consent === true}
                onChange={v => { setConsent(v); Telemetry.setConsent(v).catch(() => { }); }}
                hideBorder
            />
            {!configured && (
                <Paragraph style={{ opacity: 0.7 }}>
                    The stats backend isn't set up yet, so nothing is sent regardless of this toggle.
                </Paragraph>
            )}
        </>
    );
}

const settings = definePluginSettings({
    consent: {
        type: OptionType.COMPONENT,
        description: "Anonymous usage stats",
        component: ConsentSetting
    }
});

export default definePlugin({
    name: "UsageStats",
    description: "Optional & anonymous: lets Kittycord count active installs and versions so it can keep improving. Sends only a random ID + version, at most once a day, and ONLY after you agree. No account, no messages, no personal data.",
    authors: [{ name: "Kittycord", id: 0n }],
    enabledByDefault: true,
    settings,

    async start() {
        try {
            const s = await Telemetry.getConsent();
            // Only ask once, and only if a stats backend is actually configured.
            if (s.endpointConfigured && s.consent === null) {
                Alerts.show({
                    title: "Help improve Kittycord? 🐱",
                    body: "May we anonymously count that you use Kittycord? It sends only a random ID + version (no account, no messages, no personal data), at most once a day. You can change this anytime under Plugins → UsageStats.",
                    confirmText: "Yes, sure",
                    cancelText: "No thanks",
                    onConfirm: () => Telemetry.setConsent(true).catch(() => { }),
                    onCancel: () => Telemetry.setConsent(false).catch(() => { })
                });
            }
        } catch (e) {
            logger.error("consent check failed", e);
        }
    }
});
