/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

import style from "./style.css?managed";

const Native = VencordNative?.pluginHelpers?.GameMode as PluginNative<typeof import("./native")> | undefined;

const DEBOUNCE_MS = 200;
let timer = -1;

function isIdle() {
    if (settings.store.trigger === "minimized") return document.hidden;
    return document.hidden || !document.hasFocus();
}

function evaluate() {
    const cl = document.documentElement.classList;
    const idle = isIdle();
    cl.toggle("kc-idle", idle);
    cl.toggle("kc-idle-noanim", idle && settings.store.pauseAnimations);
    cl.toggle("kc-idle-noblur", idle && settings.store.pauseBlur);
    void Native?.setBackgroundThrottle(idle && settings.store.throttleBackground);
}

function schedule() {
    clearTimeout(timer);
    timer = window.setTimeout(evaluate, DEBOUNCE_MS);
}

const settings = definePluginSettings({
    trigger: {
        type: OptionType.SELECT,
        description: "When to ease off the visual effects to free up your GPU",
        options: [
            { label: "Whenever Discord isn't the focused window (best for games)", value: "unfocused", default: true },
            { label: "Only when Discord is minimised or hidden", value: "minimized" }
        ],
        onChange: evaluate
    },
    pauseAnimations: {
        type: OptionType.BOOLEAN,
        description: "Pause animations and the pet while Discord is in the background",
        default: true,
        onChange: evaluate
    },
    pauseBlur: {
        type: OptionType.BOOLEAN,
        description: "Drop background blur while Discord is in the background (big win on weak GPUs)",
        default: true,
        onChange: evaluate
    },
    throttleBackground: {
        type: OptionType.BOOLEAN,
        description: "Let Discord idle in the background to free your GPU for games (voice keeps working)",
        default: true,
        onChange: evaluate
    }
});

export default definePlugin({
    name: "GameMode",
    description: "Eases off Kittycord's visual effects (animations, blur, the pet, cursor buddies) while Discord is in the background, so your games and other apps run smoother.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: true,
    settings,

    start() {
        enableStyle(style);
        window.addEventListener("blur", schedule);
        window.addEventListener("focus", schedule);
        document.addEventListener("visibilitychange", schedule);
        evaluate();
    },

    stop() {
        clearTimeout(timer);
        window.removeEventListener("blur", schedule);
        window.removeEventListener("focus", schedule);
        document.removeEventListener("visibilitychange", schedule);
        document.documentElement.classList.remove("kc-idle", "kc-idle-noanim", "kc-idle-noblur");
        void Native?.setBackgroundThrottle(false);
        disableStyle(style);
    }
});
