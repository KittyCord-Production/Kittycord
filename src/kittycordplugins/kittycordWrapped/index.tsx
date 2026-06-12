/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import { addMessagePreSendListener, type MessageSendListener,removeMessagePreSendListener } from "@api/MessageEvents";
import { showNotification } from "@api/Notifications";
import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";

import { settings } from "./settings";
import { flush, loadData, track } from "./storage";
import { openWrappedModal } from "./WrappedModal";

const logger = new Logger("KittycordWrapped");

function maybeNudge(milestone: number) {
    if (!settings.store.nudges) return;

    const shown = settings.store.shownMilestones.split(",").filter(Boolean);
    if (shown.includes(String(milestone))) return;

    settings.store.shownMilestones = [...shown, String(milestone)].join(",");
    showNotification({
        title: "Your Kittycord Wrapped is ready 🎁",
        body: `You just passed ${milestone.toLocaleString()} messages — open your Wrapped card to see your vibe.`,
        onClick: () => openWrappedModal()
    });
}

const onPreSend: MessageSendListener = channelId => {
    try {
        const milestone = track(channelId);
        if (milestone) maybeNudge(milestone);
    } catch (e) {
        logger.error("tracking failed", e);
    }
};

export default definePlugin({
    name: "KittycordWrapped",
    description: "Your personal Discord year in a shareable, Kittycord-styled stats card — your vibe, your busiest servers and more. Everything stays 100% on your device; share the card only if you want to.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility", "Fun"],
    dependencies: ["CommandsAPI"],
    settings,

    commands: [
        {
            name: "wrapped",
            description: "Open your Kittycord Wrapped card",
            inputType: ApplicationCommandInputType.BUILT_IN,
            execute: () => {
                openWrappedModal();
            }
        }
    ],

    toolboxActions: {
        "Open Kittycord Wrapped"() {
            openWrappedModal();
        }
    },

    async start() {
        await loadData();
        addMessagePreSendListener(onPreSend);

        if (!settings.store.introShown) {
            settings.store.introShown = true;
            showNotification({
                title: "Kittycord Wrapped is on 🐱",
                body: "Your stats stay 100% on your device. Open your card anytime with /wrapped.",
                onClick: () => openWrappedModal()
            });
            return;
        }

        const now = new Date();
        if (settings.store.nudges && now.getMonth() === 11 && settings.store.lastYearEndNudge < now.getFullYear()) {
            settings.store.lastYearEndNudge = now.getFullYear();
            showNotification({
                title: "Your Kittycord Wrapped is ready 🎁",
                body: `${now.getFullYear()} is wrapping up — open your card and see your year on Discord.`,
                onClick: () => openWrappedModal()
            });
        }
    },

    stop() {
        removeMessagePreSendListener(onPreSend);
        void flush();
    }
});
