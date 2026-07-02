/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { isPluginEnabled, plugins } from "@api/PluginManager";
import { openSettingsTabModal, PluginsTab } from "@components/settings";
import definePlugin from "@utils/types";
import { Menu, Popout, useRef, useState } from "@webpack/common";

import { BRAND_ICON } from "../../branding";
import { buildCustomPluginEntries, buildPluginMenuEntries, buildThemeMenu } from "./menu";

interface Feature {
    plugin: string;
    action: string;
    label: string;
}

const FEATURES: Feature[] = [
    { plugin: "Modes", action: "Open Modes", label: "Modes" },
    { plugin: "MessageTags", action: "Open Tagged Messages", label: "Tagged messages" },
    { plugin: "Bookmarks", action: "Open Bookmarks", label: "Bookmarks" },
    { plugin: "SavedHub", action: "Open Saved", label: "Saved" },
    { plugin: "ScheduledMessages", action: "Open Scheduler", label: "Scheduled messages" },
    { plugin: "KittycordStudio", action: "Open Studio", label: "Theme Studio" },
    { plugin: "KittycordCosmetics", action: "Style your name", label: "Name style" },
    { plugin: "Looks", action: "Open Looks", label: "Looks" },
    { plugin: "KittyPet", action: "Open KittyPet", label: "KittyPet" },
    { plugin: "KittyPet", action: "Play with KittyPet", label: "Play with KittyPet" },
    { plugin: "MiniGames", action: "Start a game", label: "Play a game" },
    { plugin: "KittycordWrapped", action: "Open Kittycord Wrapped", label: "Wrapped" },
    { plugin: "ShareSetup", action: "Open Kittycord friends", label: "Kittycord friends" },
    { plugin: "ShareSetup", action: "Share setup with a friend", label: "Share setup" },
    { plugin: "InviteFriend", action: "Invite a friend", label: "Invite a friend" },
    { plugin: "KittyInvites", action: "Share invite stats", label: "Invite stats" },
    { plugin: "ShowOff", action: "Show off my Kittycord look", label: "Show off my look" },
    { plugin: "Onboarding", action: "Run setup wizard", label: "Setup wizard" },
    { plugin: "CommunityHub", action: "Open Community", label: "Community" },
    { plugin: "KittycordDoctor", action: "Open Doctor", label: "Doctor" }
];

function KittyIcon({ width = 20, height = 20 }: { width?: number; height?: number; }) {
    return <img src={BRAND_ICON} width={width} height={height} style={{ borderRadius: 6, display: "block" }} />;
}

function resolveAction(feature: Feature): (() => void) | null {
    const plugin = plugins[feature.plugin];
    if (!plugin || !isPluginEnabled(feature.plugin)) return null;
    const actions = plugin.toolboxActions;
    if (!actions || typeof actions === "function") return null;
    const fn = actions[feature.action];
    return typeof fn === "function" ? fn : null;
}

const CURATED_PLUGINS = new Set(FEATURES.map(feature => feature.plugin));

function renderMenu(onClose: () => void) {
    return (
        <Menu.Menu navId="kittycord-menu" onClose={onClose}>
            <Menu.MenuGroup label="Kittycord">
                {FEATURES.map(feature => {
                    const action = resolveAction(feature);
                    return (
                        <Menu.MenuItem
                            id={`kittycord-menu-${feature.plugin}-${feature.label}`}
                            key={`${feature.plugin}-${feature.label}`}
                            label={action ? feature.label : `${feature.label} (off)`}
                            disabled={!action}
                            action={action ? () => { onClose(); action(); } : undefined}
                        />
                    );
                })}
            </Menu.MenuGroup>

            <Menu.MenuSeparator />

            <Menu.MenuItem
                id="kittycord-menu-notification-log"
                label="Notification Log"
                action={openNotificationLogModal}
            />
            {buildThemeMenu()}
            <Menu.MenuItem
                id="kittycord-menu-plugins"
                label="Plugins"
                action={() => openSettingsTabModal(PluginsTab)}
            >
                {buildPluginMenuEntries()}
            </Menu.MenuItem>

            {buildCustomPluginEntries(CURATED_PLUGINS)}
        </Menu.Menu>
    );
}

function KittycordMenuButton() {
    const buttonRef = useRef(null);
    const [show, setShow] = useState(false);

    return (
        <Popout
            position="bottom"
            align="center"
            spacing={0}
            animation={Popout.Animation.NONE}
            shouldShow={show}
            onRequestClose={() => setShow(false)}
            targetElementRef={buttonRef}
            renderPopout={() => renderMenu(() => setShow(false))}
        >
            {(_, { isShown }) => (
                <HeaderBarButton
                    ref={buttonRef}
                    icon={KittyIcon}
                    tooltip={isShown ? null : "Kittycord"}
                    onClick={() => setShow(v => !v)}
                    selected={isShown}
                />
            )}
        </Popout>
    );
}

export default definePlugin({
    name: "KittycordMenu",
    description: "Adds one Kittycord button to the channel header that opens your Kittycord features — Modes, Tagged messages, Bookmarks, Share setup and the setup wizard — all in one place.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,
    dependencies: ["HeaderBarAPI"],

    start() {
        addHeaderBarButton("kittycord-menu", () => <KittycordMenuButton />, 9);
    },

    stop() {
        removeHeaderBarButton("kittycord-menu");
    }
});
