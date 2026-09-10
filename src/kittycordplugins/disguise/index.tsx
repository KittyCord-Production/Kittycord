/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ShieldIcon } from "@components/Icons";
import { openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import type { User, UserProfile } from "@vencord/discord-types";
import { Menu, SnowflakeUtils, UserStore } from "@webpack/common";

import { DisguiseModal } from "./DisguiseModal";
import { Disguise, getDisguise, settings } from "./settings";

interface AvatarTarget {
    id: string;
    avatar: string;
    discriminator: string;
    bot: boolean;
}

interface MemberAvatarConfig {
    guildId: string;
    userId: string;
    avatar: string;
    canAnimate?: boolean;
    size?: number;
}

interface BannerConfig {
    id: string;
    banner: string | null | undefined;
    canAnimate?: boolean;
    size?: number;
}

const NO_ACTIVITIES: unknown[] = [];
const NO_NOTE = { loading: false, note: null };
const mergedProfiles = new WeakMap<UserProfile, UserProfile>();

let avatarURL: (user: AvatarTarget, ...args: unknown[]) => string;

function standIn(disguise: Disguise): AvatarTarget {
    return {
        id: disguise.templateId,
        avatar: disguise.avatar,
        discriminator: disguise.discriminator,
        bot: false
    };
}

function disguiseMenuItem(userId: string) {
    return (
        <Menu.MenuItem
            id="kc-disguise"
            label={getDisguise(userId) ? "Change disguise" : "Disguise"}
            icon={ShieldIcon}
            leadingAccessory={{ type: "icon", icon: ShieldIcon }}
            action={() => openModal(modalProps => <DisguiseModal modalProps={modalProps} userId={userId} />)}
        />
    );
}

function userContextPatch(children: Array<React.ReactNode>, { user }: { user?: User; }) {
    if (!user || user.id === UserStore.getCurrentUser()?.id) return;
    children.push(disguiseMenuItem(user.id));
}

export default definePlugin({
    name: "Disguise",
    description: "Make chosen people look like someone else on your screen. Name, avatar and profile are swapped locally, so a glance at your client never gives away who you are talking to.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Privacy", "Appearance"],
    settings,

    contextMenus: {
        "user-context": userContextPatch,
        "user-profile-actions": userContextPatch
    },

    patches: [
        {
            find: "this.globalName?.length===0",
            replacement: {
                match: /this\.globalName\?\.length===0&&\(this\.globalName=null\)/,
                replace: "$&,$self.applyDisguise(this)"
            }
        },
        {
            find: "getUserAvatarURL:",
            replacement: [
                {
                    match: /(getUserAvatarURL:)(\i),/,
                    replace: "$1$self.avatarHook($2),"
                },
                {
                    match: /(getUserAvatarSource:)(\(\i,\i,\i\)=>\i\(\i\(\i,\i,\i\)\))/,
                    replace: "$1$self.avatarSourceHook($2)"
                },
                {
                    match: /(getGuildMemberAvatarURLSimple:)(\i),/,
                    replace: "$1$self.memberAvatarHook($2),"
                },
                {
                    match: /(getUserBannerURL:)(\i),/,
                    replace: "$1$self.bannerHook($2),"
                }
            ]
        },
        {
            find: 'displayName="UserProfileStore"',
            replacement: [
                {
                    match: /(?<=getUserProfile\(\i\)\{return )(.+?)(?=\})/,
                    replace: "$self.profileHook($1)"
                },
                {
                    match: /(?<=getGuildMemberProfile\(\i,\i\)\{return )(.+?)(?=\})/,
                    replace: "$self.profileHook($1)"
                }
            ]
        },
        {
            find: 'displayName="PresenceStore"',
            replacement: {
                match: /(getActivities\((\i)\)\{)/,
                replace: "$1if($self.isDisguised($2))return $self.noActivities;"
            }
        },
        {
            find: "addKVDatabase(\"notes\")",
            replacement: {
                match: /(getNote\((\i)\)\{)/,
                replace: "$1if($self.isDisguised($2))return $self.noNote;"
            }
        },
        {
            find: 'displayName="ApplicationStreamingStore"',
            replacement: [
                {
                    match: /(getAnyStreamForUser\((\i)\)\{)/,
                    replace: "$1if($self.isDisguised($2))return null;"
                },
                {
                    match: /(getAnyDiscoverableStreamForUser\((\i)\)\{)/,
                    replace: "$1if($self.isDisguised($2))return null;"
                }
            ]
        },
        {
            find: "USER_APPLICATION_IDENTITY_FETCH_USER_START:",
            replacement: [
                {
                    match: /(getUserIdentities\((\i)\)\{)/,
                    replace: "$1if($self.isDisguised($2))return null;"
                },
                {
                    match: /(getUserIdentityByApplication\((\i),\i\)\{)/,
                    replace: "$1if($self.isDisguised($2))return null;"
                }
            ]
        },
        {
            find: /extractTimestamp\(\i\),\i\),\i=\(0,\i\.\i\)\(\i\?\.joinedAt/,
            replacement: {
                match: /\.extractTimestamp\((\i)\)(?=,\i\),\i=.{0,30}?\.joinedAt)/,
                replace: ".extractTimestamp($self.dateId($1))"
            }
        },
        {
            find: "getCachedSelfMember(",
            replacement: {
                match: /(getNick\(\i,(\i)\)\{)/,
                replace: "$1if($self.isDisguised($2))return null;"
            }
        },
        {
            find: 'displayName="RelationshipStore"',
            replacement: [
                {
                    match: /(getNickname\((\i)\)\{)(?=return \i\[\2\]\})/,
                    replace: "$1if($self.isDisguised($2))return null;"
                },
                {
                    match: /(getNote\((\i)\)\{)(?=return \i\[\2\]\})/,
                    replace: "$1if($self.isDisguised($2))return null;"
                }
            ]
        }
    ],

    isDisguised(userId: string) {
        return getDisguise(userId) !== undefined;
    },

    dateId(userId: string) {
        return getDisguise(userId)?.templateId ?? userId;
    },

    noActivities: NO_ACTIVITIES,

    noNote: NO_NOTE,

    applyDisguise(user: User) {
        const disguise = getDisguise(user.id);
        if (!disguise) return;

        user.username = disguise.username;
        user.globalName = disguise.globalName;
        user.discriminator = disguise.discriminator;
        user.banner = null;
        user.guildMemberAvatars = {};
        user.primaryGuild = null;
        user.collectibles = null;
        user.displayNameStyles = null;
        user.avatarDecorationData = null;
        Reflect.set(user, "avatarDecoration", null);

        Object.defineProperty(user, "createdAt", {
            get: () => new Date(SnowflakeUtils.extractTimestamp(disguise.templateId)),
            configurable: true
        });
    },

    avatarHook(original: (user: AvatarTarget, ...args: unknown[]) => string) {
        avatarURL = original;
        return this.avatarSourceHook(original);
    },

    avatarSourceHook<T>(original: (user: AvatarTarget, ...args: unknown[]) => T) {
        return (user: AvatarTarget, ...args: unknown[]) => {
            const disguise = getDisguise(user.id);
            return original(disguise ? standIn(disguise) : user, ...args);
        };
    },

    memberAvatarHook<T>(original: (config: MemberAvatarConfig) => T) {
        return (config: MemberAvatarConfig) => {
            const disguise = getDisguise(config.userId);
            if (!disguise) return original(config);
            return avatarURL(standIn(disguise), config.canAnimate, config.size);
        };
    },

    bannerHook<T>(original: (config: BannerConfig) => T) {
        return (config: BannerConfig) => {
            const disguise = getDisguise(config.id);
            if (!disguise) return original(config);
            return original({ ...config, id: disguise.templateId, banner: disguise.banner });
        };
    },

    profileHook(profile: UserProfile | null) {
        const disguise = profile && getDisguise(profile.userId);
        if (!disguise) return profile;

        const cached = mergedProfiles.get(profile);
        if (cached) return cached;

        const merged: UserProfile = Object.assign(Object.create(Object.getPrototypeOf(profile)), profile, {
            bio: "",
            pronouns: "",
            banner: disguise.banner,
            accentColor: null,
            themeColors: undefined,
            legacyUsername: undefined,
            badges: [],
            collectibles: [],
            profileEffectId: undefined,
            popoutAnimationParticleType: null,
            connectedAccounts: [],
            applicationRoleConnections: [],
            application: null,
            premiumSince: null,
            premiumGuildSince: null
        });
        mergedProfiles.set(profile, merged);
        return merged;
    }
});
