/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

import { openLookModal } from "../_shared/lookModal";

export default definePlugin({
    name: "ShowOff",
    description: "Turn your Kittycord look — name colour, badges and avatar decoration — into a card you can post anywhere, even to friends who don't have Kittycord yet.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    toolboxActions: {
        "Show off my Kittycord look"() {
            openLookModal();
        }
    }
});
