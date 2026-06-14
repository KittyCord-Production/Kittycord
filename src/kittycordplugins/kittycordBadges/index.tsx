/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import definePlugin from "@utils/types";

import { BRAND_ICON } from "../../branding";

// Discord user IDs of Kittycord developers. Add more here as the team grows.
const KITTYCORD_DEVELOPERS = new Set<string>([
    "432588595845398548" // CenturyRV - creator
]);

const DeveloperBadge: ProfileBadge = {
    id: "kittycord-developer",
    description: "Kittycord Developer",
    iconSrc: BRAND_ICON,
    position: BadgePosition.START,
    link: "https://github.com/KittyCord-Production/Kittycord",
    shouldShow: ({ userId }) => KITTYCORD_DEVELOPERS.has(userId)
};

export default definePlugin({
    name: "KittycordBadges",
    description: "Shows a Kittycord Developer badge on the profiles of Kittycord's developers. Visible to everyone running Kittycord.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["BadgeAPI"],
    // Always on and not user-disableable, so the developer badge always shows.
    required: true,

    start() {
        addProfileBadge(DeveloperBadge);
    },

    stop() {
        removeProfileBadge(DeveloperBadge);
    }
});
