/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Ported to Kittycord from moggcord (originally from Nightcord).

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { moment } from "@webpack/common";

const settings = definePluginSettings({
    format: {
        type: OptionType.SELECT,
        description: "Seconds format displayed on every message timestamp",
        default: "HH:mm:ss",
        options: [
            { label: "15:34:21  (24h)", value: "HH:mm:ss", default: true },
            { label: "3:34:21 PM  (12h)", value: "h:mm:ss A" },
        ],
    },
    dateFormat: {
        type: OptionType.SELECT,
        description: "Show the date in front of the time",
        default: "",
        options: [
            { label: "Off, time only", value: "", default: true },
            { label: "04/08/26  (day first)", value: "DD/MM/YY" },
            { label: "08/04/26  (month first)", value: "MM/DD/YY" },
            { label: "2026-08-04  (year first)", value: "YYYY-MM-DD" },
            { label: "Tue  (weekday)", value: "ddd" },
            { label: "Tue 04/08/26  (weekday and date)", value: "ddd DD/MM/YY" },
        ],
    },
    showInTooltip: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in the hover tooltip",
        default: true,
    },
    showInCompact: {
        type: OptionType.BOOLEAN,
        description: "Show seconds in compact mode",
        default: true,
    },
});

type TimestampType = "cozy" | "compact" | "tooltip";

function withDate(fmt: string): string {
    const datePart = settings.store.dateFormat;
    return datePart ? `${datePart} ${fmt}` : fmt;
}

function formatTimestamp(date: Date, type: TimestampType): string {
    const fmt = settings.store.format ?? "HH:mm:ss";

    switch (type) {
        case "cozy":
            return moment(date).format(withDate(fmt));
        case "compact":
            return settings.store.showInCompact
                ? moment(date).format(withDate(fmt))
                : moment(date).format(withDate("LT"));
        case "tooltip":
            return settings.store.showInTooltip
                ? moment(date).format(`dddd, MMMM D, YYYY [at] ${fmt}`)
                : moment(date).format("LLLL");
    }
}

export default definePlugin({
    name: "RealtimeTimestamps",
    description: "Shows seconds on message timestamps (e.g. 15:34:21), with an optional date in front (e.g. 04/08/26 15:34:21). Updates when messages re-render; live ticking is disabled to avoid renderer freezes in busy channels.",
    tags: ["Appearance", "Chat", "Utility"],
    authors: [{ name: "Moggcord", id: 253979869n }],
    enabledByDefault: true,
    settings,

    /** Must return a string — Discord calls .match() on the useMemo result. */
    renderTimestamp(date: Date, type: TimestampType): string {
        return formatTimestamp(date, type);
    },

    patches: [
        {
            find: "#{intl::MESSAGE_EDITED_TIMESTAMP_A11Y_LABEL}",
            replacement: [
                {
                    match: /(\i\.useMemo\(.{0,50}"LT".{0,30}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'compact')",
                },
                {
                    match: /(\i\.useMemo\(.{0,10}\i\.\i\)\(.{0,10}\]\))/,
                    replace: "$self.renderTimestamp(arguments[0].timestamp,'cozy')",
                },
                {
                    match: /(__unsupportedReactNodeAsText:).{0,25}"LLLL"\)/,
                    replace: "$1$self.renderTimestamp(arguments[0].timestamp,'tooltip')",
                },
            ],
        },
        {
            find: /.full,.{0,15}children:/,
            replacement: {
                match: /(__unsupportedReactNodeAsText:)\i\.full/,
                replace: "$1$self.renderTimestamp(new Date(arguments[0].node.timestamp * 1000),'tooltip')",
            },
        },
    ],
});
