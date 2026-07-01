/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType, type PluginNative } from "@utils/types";
import { Button, React, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType, CSSProperties } from "react";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

interface Cosmetic {
    color1: string;
    color2?: string;
    effect?: string;
}

const Native = VencordNative?.pluginHelpers?.KittycordCosmetics as PluginNative<typeof import("./native")> | undefined;

const HEX_RE = /^#[0-9a-f]{6}$/i;
const cosmetics = new Map<string, Cosmetic>();
let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function refresh() {
    if (!Native) return;
    const list = await Native.getCosmetics();
    cosmetics.clear();
    for (const c of list) cosmetics.set(c.id, { color1: c.color1, color2: c.color2, effect: c.effect });
}

const PRESETS: Array<{ name: string; color1: string; color2: string; }> = [
    { name: "Kittycord", color1: "#FF5FA6", color2: "#FF8AC4" },
    { name: "Sunset", color1: "#FF7A59", color2: "#FFD46B" },
    { name: "Ocean", color1: "#58B9FF", color2: "#6BFFE3" },
    { name: "Lilac", color1: "#B58CFF", color2: "#FF8AC4" },
    { name: "Mint", color1: "#6BFFB4", color2: "#58D6FF" },
    { name: "Cherry", color1: "#FF4D6D", color2: "#FFB3C6" }
];

function nameStyle(color1: string, color2?: string): CSSProperties {
    if (color2) {
        return {
            backgroundImage: `linear-gradient(90deg, ${color1}, ${color2})`,
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent"
        };
    }
    return { color: color1 };
}

function NameStyleEditor() {
    const [color1, setColor1] = React.useState("");
    const [color2, setColor2] = React.useState("");
    const [persisted, setPersisted] = React.useState(false);
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        (async () => {
            await refresh();
            const me = UserStore.getCurrentUser();
            const c = me && cosmetics.get(me.id);
            if (c) {
                setColor1(c.color1);
                setColor2(c.color2 ?? "");
                setPersisted(true);
            }
        })();
    }, []);

    if (!Native) {
        return (
            <Text variant="text-sm/normal" style={{ opacity: 0.8 }}>
                Name styles are available on the Kittycord desktop app.
            </Text>
        );
    }

    async function save() {
        const me = UserStore.getCurrentUser();
        if (!me?.id || !Native) return;
        const c1 = color1.trim();
        const c2 = color2.trim();
        if (!HEX_RE.test(c1)) { showToast("Pick a first color like #FF5FA6.", Toasts.Type.FAILURE); return; }
        if (c2 && !HEX_RE.test(c2)) { showToast("The second color must look like #FF8AC4.", Toasts.Type.FAILURE); return; }

        setBusy(true);
        const res = await Native.setCosmetic(me.id, c1, c2 || undefined, undefined);
        setBusy(false);
        if (res.ok) {
            cosmetics.set(me.id, { color1: c1, color2: c2 || undefined });
            setPersisted(true);
            showToast("Name style saved.", Toasts.Type.SUCCESS);
        } else {
            showToast(res.error ?? "Could not save the style.", Toasts.Type.FAILURE);
        }
    }

    async function remove() {
        const me = UserStore.getCurrentUser();
        if (!me?.id || !Native) return;
        setBusy(true);
        await Native.clearCosmetic(me.id);
        setBusy(false);
        cosmetics.delete(me.id);
        setColor1("");
        setColor2("");
        setPersisted(false);
        showToast("Name style removed.", Toasts.Type.SUCCESS);
    }

    const me = UserStore.getCurrentUser();
    const previewName = me?.username ?? "your name";
    const validPreview = HEX_RE.test(color1.trim());

    return (
        <>
            <Text variant="text-sm/normal" style={{ opacity: 0.8, marginBottom: 8 }}>
                Pick one color for a solid name or two for a gradient. Everyone using Kittycord sees it in chat and the member list.
            </Text>
            <Flex style={{ gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                {PRESETS.map(p => (
                    <div
                        key={p.name}
                        role="button"
                        onClick={() => { setColor1(p.color1); setColor2(p.color2); }}
                        style={{
                            padding: "4px 12px",
                            borderRadius: 999,
                            cursor: "pointer",
                            backgroundImage: `linear-gradient(90deg, ${p.color1}, ${p.color2})`,
                            color: "#1a0e14",
                            fontSize: 12,
                            fontWeight: 600
                        }}
                    >
                        {p.name}
                    </div>
                ))}
            </Flex>
            <Flex style={{ gap: 8, alignItems: "center", marginBottom: 10 }}>
                <div style={{ width: 110 }}>
                    <TextInput value={color1} onChange={setColor1} placeholder="#FF5FA6" maxLength={7} />
                </div>
                <div style={{ width: 110 }}>
                    <TextInput value={color2} onChange={setColor2} placeholder="#FF8AC4" maxLength={7} />
                </div>
                <Text variant="text-md/semibold" style={validPreview ? nameStyle(color1.trim(), HEX_RE.test(color2.trim()) ? color2.trim() : undefined) : {}}>
                    {previewName}
                </Text>
            </Flex>
            <Flex style={{ gap: 8 }}>
                <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} disabled={busy} onClick={save}>
                    Save
                </Button>
                {persisted && (
                    <Button color={Button.Colors.RED} look={Button.Looks.LINK} size={Button.Sizes.SMALL} disabled={busy} onClick={remove}>
                        Remove
                    </Button>
                )}
            </Flex>
        </>
    );
}

function NameStyleModal({ rootProps }: { rootProps: any; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Style your name</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <NameStyleEditor />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

const settings = definePluginSettings({
    style: {
        type: OptionType.COMPONENT,
        description: "Your name style",
        component: NameStyleEditor
    }
});

export default definePlugin({
    name: "KittycordCosmetics",
    description: "Give your username a color or gradient that everyone using Kittycord can see — in chat and the member list.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Customisation", "Appearance"],
    enabledByDefault: true,
    settings,

    patches: [
        {
            find: '="SYSTEM_TAG"',
            replacement: {
                match: /(?<=colorString:\i,colorStrings:\i,colorRoleName:\i.*?}=)(\i),/,
                replace: "$self.wrapMessageColorProps($1, arguments[0]),"
            },
            noWarn: true
        },
        {
            find: "#{intl::GUILD_OWNER}),children:",
            replacement: {
                match: /(?<=roleName:\i,)colorString:/,
                replace: "colorString:$self.memberListColorString(arguments[0]),kittycordColorString:"
            },
            noWarn: true
        }
    ],

    wrapMessageColorProps(colorProps: { colorString?: string; colorStrings?: Record<"primaryColor" | "secondaryColor" | "tertiaryColor", string | undefined>; }, context: any) {
        try {
            const c = cosmetics.get(context?.message?.author?.id);
            if (!c) return colorProps;
            return {
                ...colorProps,
                colorString: c.color1,
                colorStrings: {
                    primaryColor: c.color1,
                    secondaryColor: c.color2,
                    tertiaryColor: undefined
                }
            };
        } catch {
            return colorProps;
        }
    },

    memberListColorString(context: any) {
        try {
            const c = cosmetics.get(context?.user?.id);
            return c?.color1 ?? context?.colorString;
        } catch {
            return context?.colorString;
        }
    },

    toolboxActions: {
        "Style your name"() {
            openModal(props => <NameStyleModal rootProps={props} />);
        }
    },

    async start() {
        await refresh();
        refreshTimer = setInterval(refresh, 10 * 60 * 1000);
    },

    stop() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
        cosmetics.clear();
    }
});
