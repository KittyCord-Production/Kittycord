/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Notice } from "@components/Notice";
import definePlugin, { OptionType } from "@utils/types";

const PLATFORMS: Record<string, object> = {
    desktop: { browser: "Discord Client" },
    web: { browser: "Discord Web" },
    android: { browser: "Discord Android" },
    ios: { browser: "Discord iOS" },
    xbox: { browser: "Discord Embedded" },
    playstation: { browser: "Discord Embedded" },
    vr: { os: "android", browser: "Discord VR", device: "Discord VR" },
    hidden: { browser: "" }
};

const settings = definePluginSettings({
    platform: {
        type: OptionType.SELECT,
        description: "The device other people see next to your status.",
        restartNeeded: true,
        options: [
            { label: "Desktop", value: "desktop", default: true },
            { label: "Web", value: "web" },
            { label: "Android", value: "android" },
            { label: "iOS", value: "ios" },
            { label: "Xbox", value: "xbox" },
            { label: "PlayStation", value: "playstation" },
            { label: "VR (experimental)", value: "vr" },
            { label: "Hidden (experimental, may still show an icon)", value: "hidden" }
        ]
    }
});

function SpooferWarning() {
    return (
        <Notice.Warning>
            Discord does not allow pretending to be on another device. We can't promise this won't get your account warned or banned. Xbox, PlayStation and VR can make Discord treat your client as outdated.
        </Notice.Warning>
    );
}

export default definePlugin({
    name: "PlatformSpoofer",
    description: "Choose which device Discord shows you on.",
    tags: ["Utility"],
    authors: [{ name: "Kittycord", id: 0n }],
    settings,
    settingsAboutComponent: SpooferWarning,

    patches: [
        {
            find: "_doIdentify(){",
            replacement: [
                {
                    match: /(?<=window\._ws=null,)null!=\i/,
                    replace: "false"
                },
                {
                    match: /(?<=\("GatewaySocket"\)\}\),properties:)\i/,
                    replace: "$self.spoof($&)"
                }
            ]
        }
    ],

    spoof(properties: object) {
        return { ...properties, ...PLATFORMS[settings.store.platform] };
    }
});
