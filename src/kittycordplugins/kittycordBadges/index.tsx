/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addProfileBadge, BadgePosition, ProfileBadge, removeProfileBadge } from "@api/Badges";
import definePlugin, { type PluginNative } from "@utils/types";

import { BRAND_WEBSITE } from "../../branding";

const svgIcon = (svg: string) => "data:image/svg+xml," + encodeURIComponent(svg);

const DEVELOPER_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><rect x='2.5' y='4.5' width='19' height='15' rx='3.5' fill='#ff5fa6'/><path fill='none' stroke='#fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M6.5 9.5 9.5 12l-3 2.5M12.5 15h5'/></svg>");
const STAFF_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ff5fa6' d='M12 2 4 5v6c0 5 3.4 8.6 8 11 4.6-2.4 8-6 8-11V5l-8-3Z'/><path fill='none' stroke='#fff' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round' d='m8.4 12 2.4 2.4 4.8-5.2'/></svg>");
const HELPER_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ff5fa6' d='M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z'/></svg>");
const DONOR_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ff5fa6' d='M12 20.7 4.3 13a5 5 0 0 1 7.05-7.05l.65.64.65-.64A5 5 0 0 1 19.7 13z'/><circle cx='8.6' cy='9.4' r='1.35' fill='#fff' opacity='.85'/></svg>");
const CONTRIBUTOR_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ff5fa6' d='M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/></svg>");
const BUGHUNTER_ICON = svgIcon("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#ff5fa6' d='M12 5c1.7 0 3.1 1 3.8 2.4C17.6 8.5 19 10.6 19 13c0 3.3-3.1 6-7 6s-7-2.7-7-6c0-2.4 1.4-4.5 3.2-5.6C8.9 6 10.3 5 12 5Z'/><path fill='none' stroke='#fff' stroke-width='1.5' stroke-linecap='round' d='M12 8.5v8M8.6 5.6 6.5 3.5M15.4 5.6l2.1-2.1'/><circle cx='9' cy='12' r='1' fill='#fff'/><circle cx='15' cy='12' r='1' fill='#fff'/></svg>");

interface TeamRole {
    id: string;
    label: string;
    icon: string;
    link: string;
    members: string[];
}

const ROLES: TeamRole[] = [
    {
        id: "kittycord-developer",
        label: "Kittycord Developer",
        icon: DEVELOPER_ICON,
        link: "https://github.com/KittyCord-Production/Kittycord",
        members: [
            "432588595845398548", // CenturyRV - Founder and lead developer
            "1030766914047332443", // Willibe - Developer and Bot maintainer
            "1014383756972400711" // Kuro - Bug Hunter and System Administrator
        ]
    },
    {
        id: "kittycord-staff",
        label: "Kittycord Staff",
        icon: STAFF_ICON,
        link: BRAND_WEBSITE,
        members: [
            // "123456789012345678" // name
        ]
    },
    {
        id: "kittycord-helper",
        label: "Kittycord Helper",
        icon: HELPER_ICON,
        link: BRAND_WEBSITE,
        members: [
            "1438522658114371708" // Sanchez - Helper and support team member
        ]
    },
    {
        id: "kittycord-donor",
        label: "Kittycord Donor",
        icon: DONOR_ICON,
        link: BRAND_WEBSITE,
        members: []
    },
    {
        id: "kittycord-contributor",
        label: "Kittycord Contributor",
        icon: CONTRIBUTOR_ICON,
        link: "https://github.com/KittyCord-Production/Kittycord",
        members: []
    },
    {
        id: "kittycord-bughunter",
        label: "Kittycord Bug Hunter",
        icon: BUGHUNTER_ICON,
        link: "https://github.com/KittyCord-Production/Kittycord",
        members: []
    }
];

const Native = VencordNative?.pluginHelpers?.KittycordBadges as PluginNative<typeof import("./native")> | undefined;

const roleMembers = new Map<string, Set<string>>(ROLES.map(role => [role.id, new Set(role.members)]));

let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function refresh() {
    if (!Native) return;
    const members = await Native.getTeam();
    if (!members) return;
    const next = new Map<string, Set<string>>(ROLES.map(role => [role.id, new Set<string>()]));
    for (const { id, role } of members) next.get(role)?.add(id);
    for (const [role, set] of next) roleMembers.set(role, set);
}

const badges: ProfileBadge[] = ROLES.map(role => ({
    id: role.id,
    description: role.label,
    iconSrc: role.icon,
    position: BadgePosition.START,
    link: role.link,
    shouldShow: ({ userId }) => roleMembers.get(role.id)?.has(userId) ?? false
}));

export default definePlugin({
    name: "KittycordBadges",
    description: "Shows Kittycord badges — team (Developer, Staff, Helper) and supporters (Donor, Contributor) — on the profiles of the people who build, support and back Kittycord. Visible to everyone running Kittycord.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["BadgeAPI"],
    required: true,

    async start() {
        badges.forEach(b => addProfileBadge(b));
        await refresh();
        refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    },

    stop() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        badges.forEach(b => removeProfileBadge(b));
    }
});
