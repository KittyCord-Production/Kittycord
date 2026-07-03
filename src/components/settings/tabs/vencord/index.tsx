/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { plugins } from "@api/PluginManager";
import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Divider } from "@components/Divider";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { FolderIcon, GithubIcon, LogIcon, PaintbrushIcon, RestartIcon, WebsiteIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { openContributorModal, openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { SpecialCard } from "@components/settings/SpecialCard";
import BadgeAPI from "@plugins/_api/badges";
import { ACCENT_PRESETS, KittycordAccent } from "@shared/accentPresets";
import { gitRemote } from "@shared/vencordUserAgent";
import { DONOR_ROLE_ID, GUILD_ID, IS_WINDOWS, VC_DONOR_ROLE_ID, VC_GUILD_ID } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { openInviteModal } from "@utils/discord";
import { Margins } from "@utils/margins";
import { isAnyPluginDev } from "@utils/misc";
import { relaunch } from "@utils/native";
import { Alerts, GuildMemberStore, React, UserStore } from "@webpack/common";

import gitHash from "~git-hash";

import { BRAND_ICON, BRAND_NAME, BRAND_WEBSITE } from "../../../../branding";
import { MacOSVibrancySettings } from "./MacVibrancySettings";
import { NotificationSection } from "./NotificationSettings";
import { WindowsMaterialSettings } from "./WindowsMaterialSettings";

const COZY_CONTRIB_IMAGE = "https://cdn.discordapp.com/emojis/1026533070955872337.png";
const CONTRIB_BACKGROUND_IMAGE = "https://media.discordapp.net/stickers/1311070166481895484.png?size=2048";

const cl = classNameFactory("vc-vencord-tab-");

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function Switches() {
    const settings = useSettings(["useQuickCss", "enableReactDevtools", "mainWindowFrameless", "frameless", "winNativeTitleBar", "transparent", "winCtrlQ", "disableMinSize"]);

    const Switches = [
        {
            key: "useQuickCss",
            title: "Enable Custom CSS",
            description: "Load custom CSS from the QuickCSS editor. This allows you to customize Discord's appearance with your own styles.",
        },
        !IS_WEB && {
            key: "enableReactDevtools",
            title: "Enable React Developer Tools",
            description: "Enable the React Developer Tools extension for debugging Discord's React components. Useful for plugin development.",
            restartRequired: true,
        },
        (!IS_WEB && !IS_DISCORD_DESKTOP || !IS_WINDOWS) && {
            key: "mainWindowFrameless",
            title: "Disable the Main Window Frame",
            description: "Remove the native window frame for a cleaner look. You can still move the window by dragging the title bar area.",
            restartRequired: true,
        },
        !IS_WEB && (!IS_DISCORD_DESKTOP || !IS_WINDOWS
            ? {
                key: "frameless",
                title: "Disable All Window Frames",
                description: "Remove the native window frame for a cleaner look. You can still move the window by dragging the title bar area.",
                restartRequired: true,
            }
            : {
                key: "winNativeTitleBar",
                title: "Use Windows' native title bar instead of Discord's custom one",
                description: "Replace Discord's custom title bar with the standard Windows title bar. This may improve compatibility with some window management tools.",
                restartRequired: true,
            }
        ),
        !IS_WEB && {
            key: "transparent",
            title: "Enable Window Transparency",
            description: "Make the Discord window transparent. A theme that supports transparency is required or this will do nothing.",
            restartRequired: true,
            warning: IS_WINDOWS
                ? "This will stop the window from being resizable and prevents you from snapping the window to screen edges."
                : "This will stop the window from being resizable.",
        },
        IS_DISCORD_DESKTOP && {
            key: "disableMinSize",
            title: "Disable Minimum Window Size",
            description: "Allow the Discord window to be resized smaller than its default minimum size. Useful for tiling window managers or small screens.",
            restartRequired: true,
        },
        !IS_WEB && IS_WINDOWS && {
            key: "winCtrlQ",
            title: "Register Ctrl+Q as shortcut to close Discord",
            description: "Add Ctrl+Q as a keyboard shortcut to close Discord. This provides an alternative to Alt+F4 for quickly closing the application.",
            restartRequired: true,
        },
    ] satisfies Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning?: string;
    }>;

    return Switches.map(setting => {
        if (!setting) {
            return null;
        }

        const { key, title, description, restartRequired, warning } = setting;

        return (
            <FormSwitch
                key={key}
                title={title}
                description={
                    warning ? (
                        <>
                            {description}
                            <Notice.Warning className={Margins.top8} style={{ width: "100%" }}>
                                {warning}
                            </Notice.Warning>
                        </>
                    ) : (
                        description
                    )
                }
                value={settings[key]}
                onChange={v => {
                    settings[key] = v;

                    if (restartRequired) {
                        Alerts.show({
                            title: "Restart Required",
                            body: "A restart is required to apply this change",
                            confirmText: "Restart now",
                            cancelText: "Later!",
                            onConfirm: relaunch
                        });
                    }
                }}
                hideBorder
            />
        );
    });
}

function AccentPicker() {
    const settings = useSettings(["kittycordAccent"]);

    return (
        <div className={cl("accent-row")} role="group" aria-label="Accent color">
            {Object.entries(ACCENT_PRESETS).map(([key, preset]) => (
                <button
                    key={key}
                    type="button"
                    className={cl("accent-swatch", { "accent-swatch-active": settings.kittycordAccent === key })}
                    style={{ background: preset.accent }}
                    aria-label={key.charAt(0).toUpperCase() + key.slice(1)}
                    aria-pressed={settings.kittycordAccent === key}
                    onClick={() => { settings.kittycordAccent = key as KittycordAccent; }}
                />
            ))}
        </div>
    );
}

const COMMUNITY_INVITE = "KaBMzypPHT";

function DiscordIcon({ className }: { className?: string; }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.27 5.33A16.6 16.6 0 0 0 14.9 4l-.27.5a13.8 13.8 0 0 1 3.94 1.27 11.7 11.7 0 0 0-9.16 0A12.6 12.6 0 0 1 13.36 4.5L13.1 4c-1.66.18-3.2.6-4.36 1.33C5.08 8.6 4.5 12.27 4.7 15.9a16.5 16.5 0 0 0 5.05 2.56l.6-.93a10.9 10.9 0 0 1-1.7-.82l.42-.32c3.2 1.5 6.66 1.5 9.84 0l.42.32c-.54.3-1.1.58-1.7.82l.6.93a16.4 16.4 0 0 0 5.05-2.56c.27-4.2-.7-7.83-3.34-10.57ZM9.68 13.93c-.8 0-1.45-.74-1.45-1.65 0-.9.64-1.65 1.45-1.65.82 0 1.47.75 1.45 1.65 0 .9-.64 1.65-1.45 1.65Zm5.36 0c-.8 0-1.45-.74-1.45-1.65 0-.9.64-1.65 1.45-1.65.82 0 1.47.75 1.45 1.65 0 .9-.63 1.65-1.45 1.65Z" />
        </svg>
    );
}

function joinCommunity() {
    openInviteModal(COMMUNITY_INVITE).catch(() =>
        VencordNative.native.openExternal(`https://discord.gg/${COMMUNITY_INVITE}`)
    );
}

function EquicordSettings() {
    const user = UserStore?.getCurrentUser();

    return (
        <SettingsTab>
            <div className={cl("hero")}>
                <img className={cl("hero-logo")} src={BRAND_ICON} alt="" aria-hidden />
                <div>
                    <div className={cl("hero-title")}>{BRAND_NAME}</div>
                    <div className={cl("hero-tagline")}>The cutest Discord client mod — plugins, themes and a whole lot of pink.</div>
                    <div className={cl("hero-badges")}>
                        <span className={cl("hero-badge")}>v{VERSION}</span>
                        <span className={cl("hero-badge")}>{gitHash}</span>
                        {IS_DEV && <span className={cl("hero-badge")}>dev</span>}
                    </div>
                </div>
            </div>

            {isAnyPluginDev(user?.id) && (
                <SpecialCard
                    title="Contributions"
                    subtitle="Thank you for contributing!"
                    description="Since you've contributed to Kittycord you now have a cool new badge!"
                    cardImage={COZY_CONTRIB_IMAGE}
                    backgroundImage={CONTRIB_BACKGROUND_IMAGE}
                    backgroundColor="#EDCC87"
                >
                    <Button
                        variant="none"
                        size="medium"
                        type="button"
                        onClick={() => openContributorModal(user)}
                        className="vc-contrib-button"
                    >
                        <GithubIcon aria-hidden fill={"#000000"} className={"vc-contrib-github"} />
                        See what you've contributed to
                    </Button>
                </SpecialCard>
            )}

            <Heading className={Margins.top16}>Quick Actions</Heading>
            <Paragraph className={Margins.bottom16}>
                Common actions you might want to perform. These shortcuts give you quick access to frequently used features without navigating through menus.
            </Paragraph>

            <QuickActionCard>
                <QuickAction
                    Icon={WebsiteIcon}
                    text="Visit kittycord.dev"
                    action={() => VencordNative.native.openExternal(BRAND_WEBSITE)}
                />
                <QuickAction
                    Icon={DiscordIcon}
                    text="Join our Discord"
                    action={joinCommunity}
                />
                <QuickAction
                    Icon={LogIcon}
                    text="Notification Log"
                    action={openNotificationLogModal}
                />
                <QuickAction
                    Icon={PaintbrushIcon}
                    text="Edit QuickCSS"
                    action={() => VencordNative.quickCss.openEditor()}
                />
                {!IS_WEB && (
                    <QuickAction
                        Icon={RestartIcon}
                        text="Relaunch Discord"
                        action={relaunch}
                    />
                )}
                {!IS_WEB && (
                    <QuickAction
                        Icon={FolderIcon}
                        text="Open Settings Folder"
                        action={() => VencordNative.settings.openFolder()}
                    />
                )}
                <QuickAction
                    Icon={GithubIcon}
                    text="View Source Code"
                    action={() =>
                        VencordNative.native.openExternal(
                            "https://github.com/" + gitRemote,
                        )
                    }
                />
            </QuickActionCard>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Accent Color</Heading>
            <Paragraph className={Margins.bottom16}>
                Pick the color Kittycord uses for its own UI and the startup screen. The startup screen picks up a new color on the next launch.
            </Paragraph>
            <AccentPicker />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Client Settings</Heading>
            <Paragraph className={Margins.bottom16}>
                Configure how Kittycord behaves and integrates with Discord. These settings affect the Discord client's appearance and behavior.
            </Paragraph>
            <Notice.Info className={Margins.bottom20} style={{ width: "100%" }}>
                You can customize where this settings section appears in Discord's settings menu by configuring the{" "}
                <a
                    role="button"
                    onClick={() => openPluginModal(plugins.Settings)}
                    style={{ cursor: "pointer", color: "var(--text-link)" }}
                >
                    Settings Plugin
                </a>.
            </Notice.Info>

            <Switches />

            <MacOSVibrancySettings />
            <WindowsMaterialSettings />

            <NotificationSection />
        </SettingsTab >
    );
}

export default wrapTab(EquicordSettings, "Kittycord Settings");

export function isEquicordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getEquicordDonorBadges(userId);
    return GuildMemberStore.getMember(GUILD_ID, userId)?.roles.includes(DONOR_ROLE_ID) || !!donorBadges;
}

export function isVencordDonor(userId: string): boolean {
    const donorBadges = BadgeAPI.getDonorBadges(userId);
    return GuildMemberStore.getMember(VC_GUILD_ID, userId)?.roles.includes(VC_DONOR_ROLE_ID) || !!donorBadges;
}
