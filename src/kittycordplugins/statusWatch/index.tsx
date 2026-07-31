/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { showNotification } from "@api/Notifications";
import { Paragraph } from "@components/Paragraph";
import { getUniqueUsername, openUserProfile } from "@utils/discord";
import definePlugin from "@utils/types";
import type { User } from "@vencord/discord-types";
import { lodash, Menu, PresenceStore, showToast, Toasts, UserStore, UserUtils } from "@webpack/common";
import type { DebouncedFunc } from "lodash";

import { loadHistory, record } from "./history";
import { openHistoryModal } from "./HistoryModal";
import { bucketBody, bucketColor, currentBucket, StatusBucket } from "./presence";
import { isWatched, settings, toggleWatch } from "./settings";

const ARM_DELAY = 10_000;

const lastNotified = new Map<string, StatusBucket>();
let armTimer: ReturnType<typeof setTimeout> | null = null;
let armed = false;

async function notify(userId: string, bucket: StatusBucket) {
    const user = UserStore.getUser(userId) ?? await UserUtils.getUser(userId).catch(() => null);
    if (!user) return;

    showNotification({
        title: getUniqueUsername(user),
        body: bucketBody(bucket),
        icon: user.getAvatarURL(undefined, 128, false),
        color: bucketColor(bucket),
        onClick: () => openUserProfile(userId)
    });
}

function runDiff() {
    const { watched } = settings.store;

    for (const userId of lastNotified.keys()) {
        if (!watched[userId]) lastNotified.delete(userId);
    }

    for (const [userId, events] of Object.entries(watched)) {
        const now = currentBucket(userId);
        if (!now) continue;

        const before = lastNotified.get(userId);
        lastNotified.set(userId, now);

        if (!armed || before === undefined || before === now) continue;

        record({ userId, from: before, to: now, at: Date.now() });
        if (events[now]) notify(userId, now);
    }
}

let check: DebouncedFunc<typeof runDiff> | null = null;

function seed() {
    lastNotified.clear();
    for (const userId of Object.keys(settings.store.watched)) {
        const bucket = currentBucket(userId);
        if (bucket) lastNotified.set(userId, bucket);
    }
}

function rearm() {
    armed = false;
    seed();
    if (armTimer) clearTimeout(armTimer);
    armTimer = setTimeout(() => {
        armed = true;
        armTimer = null;
    }, ARM_DELAY);
}

const UserContext: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user || user.id === UserStore.getCurrentUser()?.id) return;

    children.splice(-1, 0, (
        <Menu.MenuCheckboxItem
            id="vc-statuswatch-user"
            label="Watch their status"
            checked={isWatched(user.id)}
            action={() => {
                if (toggleWatch(user.id)) {
                    const bucket = currentBucket(user.id);
                    if (bucket) lastNotified.set(user.id, bucket);
                    showToast("You'll get a notification when their status changes.", Toasts.Type.SUCCESS);
                } else {
                    lastNotified.delete(user.id);
                    showToast("No longer watching their status.", Toasts.Type.SUCCESS);
                }
            }}
        />
    ));
};

function AboutStatusWatch() {
    return (
        <Paragraph>
            Right click someone and pick "Watch their status" to add them. Discord only sends someone's status
            to you if you're friends or share a server, so anyone else will always look offline here.
        </Paragraph>
    );
}

export default definePlugin({
    name: "StatusWatch",
    description: "Get a notification when someone you watch comes online, goes idle or disappears. Right click a person to start watching them.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Friends", "Notifications"],
    settings,
    settingsAboutComponent: AboutStatusWatch,

    contextMenus: {
        "user-context": UserContext
    },

    toolboxActions: {
        "Status Changes": openHistoryModal
    },

    flux: {
        CONNECTION_OPEN() {
            rearm();
        }
    },

    async start() {
        await loadHistory();
        rearm();
        check = lodash.debounce(runDiff, 3000, { maxWait: 10_000 });
        PresenceStore.addChangeListener(check);
    },

    stop() {
        if (check) {
            PresenceStore.removeChangeListener(check);
            check.cancel();
            check = null;
        }
        if (armTimer) {
            clearTimeout(armTimer);
            armTimer = null;
        }
        armed = false;
        lastNotified.clear();
    }
});
