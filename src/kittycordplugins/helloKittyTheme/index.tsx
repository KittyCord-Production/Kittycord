/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "HelloKittyTheme",
    description: "A dark frosted-glass theme with a pink accent and rounded corners. Glass blur, pink ping/live badges and more. Message text stays at Discord's default colour. Tweak everything in the :root block of the theme's CSS.",
    authors: [{ name: "MaxiN", id: 0n }],
    tags: ["Appearance", "Customisation"],

    start() {
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});
