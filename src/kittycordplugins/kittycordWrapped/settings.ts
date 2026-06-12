/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    nudges: {
        type: OptionType.BOOLEAN,
        description: "Nudge me when my Wrapped hits a new milestone",
        default: true
    },
    showServerNames: {
        type: OptionType.BOOLEAN,
        description: "Show real server names on the card by default (off = anonymized)",
        default: false,
        hidden: true
    },
    introShown: {
        type: OptionType.BOOLEAN,
        description: "internal",
        default: false,
        hidden: true
    },
    shownMilestones: {
        type: OptionType.STRING,
        description: "internal",
        default: "",
        hidden: true
    },
    lastYearEndNudge: {
        type: OptionType.NUMBER,
        description: "internal",
        default: 0,
        hidden: true
    }
});
