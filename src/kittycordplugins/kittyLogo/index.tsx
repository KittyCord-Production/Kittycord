/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";

import { BRAND_ICON } from "../../branding";
import style from "./style.css?managed";

export default definePlugin({
    name: "KittyLogo",
    description: "Replaces the Discord logo on the home button with the Kittycord cat.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Customisation"],

    start() {
        document.documentElement.style.setProperty("--kc-logo", `url("${BRAND_ICON}")`);
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
        document.documentElement.style.removeProperty("--kc-logo");
    }
});
