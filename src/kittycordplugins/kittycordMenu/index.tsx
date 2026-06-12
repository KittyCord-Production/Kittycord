/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { isPluginEnabled, plugins } from "@api/PluginManager";
import { openSettingsTabModal, PluginsTab } from "@components/settings";
import definePlugin from "@utils/types";
import { Menu, Popout, useRef, useState } from "@webpack/common";

import { BRAND_ICON } from "../../branding";

interface Feature {
    plugin: string;
    action: string;
    label: string;
}

const FEATURES: Feature[] = [
    { plugin: "Modes", action: "Open Modes", label: "Modes" },
    { plugin: "MessageTags", action: "Open Tagged Messages", label: "Tagged messages" },
    { plugin: "Bookmarks", action: "Open Bookmarks", label: "Bookmarks" },
    { plugin: "KittycordStudio", action: "Open Studio", label: "Theme Studio" },
    { plugin: "KittycordCosmetics", action: "Style your name", label: "Name style" },
    { plugin: "KittyPet", action: "Open KittyPet", label: "KittyPet" },
    { plugin: "MiniGames", action: "Start a game", label: "Play a game" },
    { plugin: "KittycordWrapped", action: "Open Kittycord Wrapped", label: "Wrapped" },
    { plugin: "ShareSetup", action: "Share setup with a friend", label: "Share setup" },
    { plugin: "InviteFriend", action: "Invite a friend", label: "Invite a friend" },
    { plugin: "Onboarding", action: "Run setup wizard", label: "Setup wizard" }
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

function renderMenu(onClose: () => void) {
    return (
        <Menu.Menu navId="kittycord-menu" onClose={onClose}>
            <Menu.MenuGroup label="Kittycord">
                {FEATURES.map(feature => {
                    const action = resolveAction(feature);
                    return (
                        <Menu.MenuItem
                            id={`kittycord-menu-${feature.plugin}`}
                            key={feature.plugin}
                            label={action ? feature.label : `${feature.label} (off)`}
                            disabled={!action}
                            action={action ? () => { onClose(); action(); } : undefined}
                        />
                    );
                })}
            </Menu.MenuGroup>
            <Menu.MenuSeparator />
            <Menu.MenuItem
                id="kittycord-menu-settings"
                label="Kittycord plugins…"
                action={() => { onClose(); openSettingsTabModal(PluginsTab); }}
            />
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
