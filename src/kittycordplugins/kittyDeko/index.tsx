/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { PaintbrushIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin, { type PluginNative } from "@utils/types";
import { Button, React, showToast, Text, Toasts, UserStore } from "@webpack/common";

import { assetUrl, byId, CATALOG, KITTY_DEKO_SKU } from "./catalog";
import style from "./style.css?managed";

const Native = VencordNative?.pluginHelpers?.KittyDeko as PluginNative<typeof import("./native")> | undefined;
const InvitesNative = VencordNative?.pluginHelpers?.KittyInvites as PluginNative<typeof import("../kittyInvites/native")> | undefined;

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
    const [invites, setInvites] = React.useState(0);
    const me = UserStore.getCurrentUser();
    const equipped = me ? deko.get(me.id) : undefined;
    const avatar = avatarUrl();

    React.useEffect(() => {
        if (InvitesNative && me) InvitesNative.getMe(me.id).then(m => setInvites(m.invites)).catch(() => { });
    }, []);

    const lockedBy = (id: string) => Math.max(0, (byId.get(id)?.minInvites ?? 0) - invites);

    async function equip(id: string | null) {
        if (!Native || !me) return;
        if (id && lockedBy(id) > 0) {
            showToast(`Invite ${byId.get(id)!.minInvites} friends to unlock this frame.`, Toasts.Type.FAILURE);
            return;
        }
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
            {CATALOG.map(d => {
                const locked = lockedBy(d.id) > 0;
                return (
                    <div className="kc-deko-tile" key={d.id}>
                        <div className="kc-deko-preview">
                            <img className="kc-deko-avatar" src={avatar} alt="" />
                            <img className="kc-deko-frame" src={assetUrl(d.id)} alt="" />
                        </div>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={equipped === d.id ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            disabled={saving != null || locked}
                            onClick={() => equip(d.id)}
                        >
                            {equipped === d.id ? "Equipped" : locked ? `🔒 ${d.minInvites} invites` : d.label}
                        </Button>
                    </div>
                );
            })}
        </div>
    );
}

function DekoTab() {
    return (
        <ErrorBoundary noop>
            <Text variant="text-md/normal" style={{ marginBottom: 16, color: "var(--text-muted)" }}>
                Pick a free decoration for your avatar — everyone on Kittycord will see it. A few special frames unlock as you invite friends with your creator code.
            </Text>
            <DekoShop />
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "KittyDeko",
    description: "Decorate your avatar with free frames that everyone using Kittycord can see — hearts, sparkles, a crown and more.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Appearance", "Customisation"],
    enabledByDefault: true,

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

    async start() {
        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "kittycord_deko",
            title: "Decorations",
            panelTitle: "Avatar Decorations",
            Component: DekoTab,
            Icon: PaintbrushIcon
        });
        await refresh();
        refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_deko");
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        deko.clear();
        emit();
        disableStyle(style);
    }
});
