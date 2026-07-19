/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { Card } from "@components/Card";
import ErrorBoundary from "@components/ErrorBoundary";
import { Heart } from "@components/Heart";
import SettingsPlugin from "@plugins/_core/settings";
import { classNameFactory } from "@utils/css";
import { removeFromArray } from "@utils/misc";
import definePlugin, { type PluginNative } from "@utils/types";
import { React, Text, UserStore } from "@webpack/common";

import { assetUrl, CATALOG } from "../kittyDeko/catalog";
import type { SupporterStatus } from "./native";

const cl = classNameFactory("vc-supportkc-");
const Native = VencordNative?.pluginHelpers?.SupportKittycord as PluginNative<typeof import("./native")> | undefined;

const SUPPORTER_FRAMES = CATALOG.filter(d => d.supporterOnly);

function SupportTab() {
    const [status, setStatus] = React.useState<SupporterStatus | null>(null);
    const me = UserStore.getCurrentUser();

    React.useEffect(() => {
        if (Native && me) Native.getStatus(me.id).then(setStatus).catch(() => { });
    }, []);

    return (
        <ErrorBoundary noop>
            <Text variant="text-md/normal" style={{ color: "var(--text-muted)" }}>
                Kittycord is free and always will be — every feature stays open to everyone. If it makes your Discord a little nicer, you can support it. Supporters get a few small thank-you perks.
            </Text>

            <div className={cl("perks")}>
                <Card style={{ padding: 16 }}>
                    <Text variant="text-md/semibold">Supporter badge</Text>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        A heart badge on your profile that everyone using Kittycord can see.
                    </Text>
                </Card>

                <Card style={{ padding: 16 }}>
                    <Text variant="text-md/semibold">Golden avatar frames</Text>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        Exclusive golden decorations, on top of all the free ones in the Decorations tab.
                    </Text>
                    <div className={cl("frames")}>
                        {SUPPORTER_FRAMES.map(d => (
                            <div className={cl("frame")} key={d.id}>
                                <img src={assetUrl(d.id)} alt={d.label} />
                                <Text variant="text-xs/normal" style={{ color: "var(--text-muted)" }}>{d.label}</Text>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <Card className={cl("status")} variant={status?.supporter ? "brand" : undefined}>
                {status?.supporter ? (
                    <>
                        <Text variant="text-md/semibold">You're a Kittycord supporter 💖</Text>
                        <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                            {status.since ? `Supporting since ${new Date(status.since).toLocaleDateString()}. ` : ""}Thank you — it genuinely helps keep Kittycord going.
                        </Text>
                    </>
                ) : (
                    <>
                        <Text variant="text-md/semibold">Supporting opens soon</Text>
                        <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                            A way to support Kittycord is on the way. Until then, the team can add supporters by hand — reach out in the community server.
                        </Text>
                    </>
                )}
            </Card>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "SupportKittycord",
    description: "A Support tab showing supporter perks and your supporter status, plus the golden decorations and badge that come with it.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    start() {
        SettingsPlugin.customEntries.push({
            key: "kittycord_support",
            title: "Support",
            panelTitle: "Support Kittycord",
            Component: SupportTab,
            Icon: Heart
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_support");
    }
});
