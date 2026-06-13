/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType, type PluginNative } from "@utils/types";
import { Button, React, showToast, Text, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { assetUrl, CATALOG, KITTY_DEKO_SKU } from "./catalog";
import style from "./style.css?managed";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const Native = VencordNative?.pluginHelpers?.KittyDeko as PluginNative<typeof import("./native")> | undefined;

const deko = new Map<string, string>();
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function emit() {
    listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
    listeners.add(cb);
    return () => void listeners.delete(cb);
}

async function refresh() {
    if (!Native) return;
    const list = await Native.getDeko();
    deko.clear();
    for (const d of list) deko.set(d.id, d.deco);
    emit();
}

function useKittyDekoDecoration(user?: { id?: string; }) {
    const id = user?.id;
    const deco_ = React.useSyncExternalStore(subscribe, () => (id ? deko.get(id) : undefined));
    return React.useMemo(() => (deco_ ? { asset: assetUrl(deco_), skuId: KITTY_DEKO_SKU } : null), [deco_]);
}

function avatarUrl(): string {
    const me = UserStore.getCurrentUser() as any;
    return me?.getAvatarURL?.(undefined, 128) ?? "";
}

function DekoShop() {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [saving, setSaving] = React.useState<string | null>(null);
    const me = UserStore.getCurrentUser();
    const equipped = me ? deko.get(me.id) : undefined;
    const avatar = avatarUrl();

    async function equip(id: string | null) {
        if (!Native || !me) return;
        setSaving(id ?? "none");
        try {
            if (id === null) {
                const ok = await Native.clearDeko(me.id);
                if (ok) {
                    deko.delete(me.id);
                    showToast("Decoration removed.", Toasts.Type.SUCCESS);
                } else {
                    showToast("Could not remove decoration.", Toasts.Type.FAILURE);
                }
            } else {
                const res = await Native.setDeko(me.id, id);
                if (res.ok) {
                    deko.set(me.id, id);
                    showToast("Decoration equipped!", Toasts.Type.SUCCESS);
                } else {
                    showToast(res.error, Toasts.Type.FAILURE);
                }
            }
        } finally {
            setSaving(null);
            emit();
            forceUpdate();
        }
    }

    return (
        <div className="kc-deko-grid">
            <div className="kc-deko-tile">
                <div className="kc-deko-preview">
                    <img className="kc-deko-avatar" src={avatar} alt="" />
                </div>
                <Button
                    size={Button.Sizes.SMALL}
                    color={equipped == null ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                    disabled={saving != null}
                    onClick={() => equip(null)}
                >
                    None
                </Button>
            </div>
            {CATALOG.map(d => (
                <div className="kc-deko-tile" key={d.id}>
                    <div className="kc-deko-preview">
                        <img className="kc-deko-avatar" src={avatar} alt="" />
                        <img className="kc-deko-frame" src={assetUrl(d.id)} alt="" />
                    </div>
                    <Button
                        size={Button.Sizes.SMALL}
                        color={equipped === d.id ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                        disabled={saving != null}
                        onClick={() => equip(d.id)}
                    >
                        {equipped === d.id ? "Equipped" : d.label}
                    </Button>
                </div>
            ))}
        </div>
    );
}

function DekoModal({ rootProps }: { rootProps: any; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>KittyDeko</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8, marginBottom: 12 }}>
                        Pick a free decoration for your avatar — everyone on Kittycord will see it.
                    </Text>
                    <DekoShop />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

const settings = definePluginSettings({
    shop: {
        type: OptionType.COMPONENT,
        description: "Your avatar decoration",
        component: () => <ErrorBoundary noop><DekoShop /></ErrorBoundary>
    }
});

export default definePlugin({
    name: "KittyDeko",
    description: "Decorate your avatar with free frames that everyone using Kittycord can see — hearts, sparkles, a crown and more.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Customisation"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            find: "getAvatarDecorationURL:",
            replacement: {
                match: /(?<=function \i\((\i)\){)(?=.{0,20}let{avatarDecoration)/,
                replace: "const kcDekoDecoration=$self.getKittyDekoAvatarDecorationURL($1);if(kcDekoDecoration)return kcDekoDecoration;"
            },
            noWarn: true
        },
        {
            find: "isAvatarDecorationAnimating:",
            group: true,
            replacement: [
                {
                    match: /(?<=\.avatarDecoration,guildId:\i\}\)\),)(?<=user:(\i).+?)/,
                    replace: "kcDekoAvatarDecoration=$self.useKittyDekoDecoration($1),"
                },
                {
                    match: /(?<={avatarDecoration:).{1,20}?(?=,)(?<=avatarDecorationOverride:(\i).+?)/,
                    replace: "$1??kcDekoAvatarDecoration??($&)"
                },
                {
                    match: /(?<=size:\i}\),\[)/,
                    replace: "kcDekoAvatarDecoration,"
                }
            ],
            noWarn: true
        },
        {
            find: ".DISPLAY_NAME_STYLES_COACHMARK)",
            replacement: {
                match: /(?<=\i\)\({avatarDecoration:)\i(?=,)(?<=currentUser:(\i).+?)/,
                replace: "$self.useKittyDekoDecoration($1)??$&"
            },
            noWarn: true
        },
        ...[
            "#{intl::GUILD_COMMUNICATION_DISABLED_ICON_TOOLTIP_BODY}",
            "#{intl::COLLECTIBLES_NAMEPLATE_PREVIEW_A11Y}",
            "#{intl::COLLECTIBLES_PROFILE_PREVIEW_A11Y}"
        ].map(find => ({
            find,
            replacement: {
                match: /(?<=userValue:)((\i(?:\.author)?)\?\.avatarDecoration)/,
                replace: "$self.useKittyDekoDecoration($2)??$1"
            },
            noWarn: true
        }))
    ],

    useKittyDekoDecoration,

    getKittyDekoAvatarDecorationURL({ avatarDecoration }: { avatarDecoration: { asset?: string; skuId?: string; } | null; }) {
        try {
            if (avatarDecoration?.skuId === KITTY_DEKO_SKU) return avatarDecoration.asset;
        } catch {
            return undefined;
        }
    },

    toolboxActions: {
        "Open KittyDeko"() {
            openModal(props => <DekoModal rootProps={props} />);
        }
    },

    async start() {
        enableStyle(style);
        await refresh();
        refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    },

    stop() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        deko.clear();
        emit();
        disableStyle(style);
    }
});
