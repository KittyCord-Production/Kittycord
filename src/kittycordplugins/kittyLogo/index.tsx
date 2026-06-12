/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { React } from "@webpack/common";

import { BRAND_ICON } from "../../branding";
import style from "./style.css?managed";

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
                match: /(\(0,\i.jsxs?\)\(\i,{}\))/,
                replace: "arguments[0].user == null ? $self.KittyIcon() : $1"
            }
        }
    ],

    start() {
        document.documentElement.style.setProperty("--kc-logo", `url("${BRAND_ICON}")`);
        enableStyle(style);
        if (settings.store.taskbarIcon) enableAppIcon();
    },

    stop() {
        disableStyle(style);
        document.documentElement.style.removeProperty("--kc-logo");
        disableAppIcon();
    }
});
