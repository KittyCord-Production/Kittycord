/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin, { OptionType } from "@utils/types";

import style from "./style.css?managed";

function apply() {
    const cl = document.documentElement.classList;
    const { ultra } = settings.store;
    cl.toggle("kc-perf-ultra", ultra);
    cl.toggle("kc-perf-noanim", ultra || settings.store.noAnimations);
    cl.toggle("kc-perf-noblur", ultra || settings.store.noBlur);
    cl.toggle("kc-perf-nodeco", ultra || settings.store.hideAvatarDecorations);
    cl.toggle("kc-perf-noplate", ultra || settings.store.hideNameplates);
    cl.toggle("kc-perf-nofx", ultra || settings.store.hideProfileEffects);
}

const settings = definePluginSettings({
    ultra: {
        type: OptionType.BOOLEAN,
        description: "Ultra performance — turns on every optimisation below and also strips shadows for maximum FPS",
        default: false,
        onChange: apply
    },
    noAnimations: {
        type: OptionType.BOOLEAN,
        description: "Turn off UI animations and transitions (big win on low-end PCs)",
        default: true,
        onChange: apply
    },
    noBlur: {
        type: OptionType.BOOLEAN,
        description: "Turn off background blur (backdrop-filter) - expensive on weak GPUs",
        default: true,
        onChange: apply
    },
    hideProfileEffects: {
        type: OptionType.BOOLEAN,
        description: "Hide animated profile effects",
        default: true,
        onChange: apply
    },
    hideAvatarDecorations: {
        type: OptionType.BOOLEAN,
        description: "Hide avatar decorations",
        default: false,
        onChange: apply
    },
    hideNameplates: {
        type: OptionType.BOOLEAN,
        description: "Hide nameplates",
        default: false,
        onChange: apply
    }
});

export default definePlugin({
    name: "PerformanceMode",
    description: "Make Discord lighter on low-end PCs: turn off animations, background blur and heavy per-user effects. Flip on Ultra for maximum FPS in one click. Note: animated emoji/GIF playback is controlled by Discord's own settings.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Utility"],
    settings,

    start() {
        enableStyle(style);
        apply();
    },

    stop() {
        disableStyle(style);
        const cl = document.documentElement.classList;
        cl.remove("kc-perf-ultra", "kc-perf-noanim", "kc-perf-noblur", "kc-perf-nodeco", "kc-perf-noplate", "kc-perf-nofx");
    }
});
