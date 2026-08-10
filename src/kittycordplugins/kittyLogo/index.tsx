/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { classNameFactory } from "@utils/css";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

import { BRAND_ICON } from "../../branding";
import style from "./style.css?managed";

const cl = classNameFactory("vc-kittylogo-");

const Native = VencordNative?.pluginHelpers?.KittyLogo as PluginNative<typeof import("./native")> | undefined;
const logger = new Logger("KittyLogo");

function enableAppIcon() {
    if (!IS_DISCORD_DESKTOP) return;
    try {
        Native?.enableAppIcon?.()?.catch?.(e => logger.error("Failed to set app icon", e));
    } catch (e) {
        logger.error("Failed to set app icon", e);
    }
}

function disableAppIcon() {
    if (!IS_DISCORD_DESKTOP) return;
    try {
        Native?.disableAppIcon?.()?.catch?.(e => logger.error("Failed to revert app icon", e));
    } catch (e) {
        logger.error("Failed to revert app icon", e);
    }
}

const settings = definePluginSettings({
    taskbarIcon: {
        type: OptionType.BOOLEAN,
        description: "Also replace the Discord taskbar / app icon with the Kittycord cat",
        default: true,
        onChange: value => (value ? enableAppIcon() : disableAppIcon())
    },
    accentTint: {
        type: OptionType.BOOLEAN,
        description: "Tint the cat on the home button with your accent colour",
        default: true,
        onChange: value => (value ? enableStyle(style) : disableStyle(style))
    }
});

export default definePlugin({
    name: "KittyLogo",
    description: "Replaces the Discord logo on the home button with the Kittycord cat, and optionally the taskbar / app icon too.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Customisation"],
    settings,

    KittyIcon() {
        return (
            <img
                src={BRAND_ICON}
                className={cl("icon")}
                width={36}
                height={36}
                style={{ borderRadius: "30%", objectFit: "contain" }}
                draggable={false}
                alt=""
            />
        );
    },

    patches: [
        {
            find: "#{intl::DISCODO_DISABLED}",
            replacement: {
                match: /\(0,\i\.jsx\)\(\i\.\i,\{size:"custom",color:"currentColor",width:\d+,height:\d+\}\)/,
                replace: "$self.KittyIcon()"
            }
        }
    ],

    start() {
        if (settings.store.taskbarIcon) enableAppIcon();
        if (settings.store.accentTint) enableStyle(style);
    },

    stop() {
        disableAppIcon();
        disableStyle(style);
    }
});
