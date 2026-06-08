/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { isPluginEnabled, pluginRequiresRestart, plugins, startPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin from "@utils/types";
import { Button, React, showToast, Text, Toasts } from "@webpack/common";
import type { ComponentType } from "react";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const SEEN_KEY = "Kittycord_OnboardingSeen";

interface Pack {
    id: string;
    title: string;
    description: string;
    plugins: string[];
    default: boolean;
}

const PACKS: Pack[] = [
    { id: "essentials", title: "Kittycord essentials", description: "Modes, sharing your setup with friends, and private bookmarks.", plugins: ["Modes", "ShareSetup", "Bookmarks"], default: true },
    { id: "calm", title: "Calm & performance", description: "Quiet hours for your status, and a lighter, smoother Discord.", plugins: ["QuietHours", "PerformanceMode"], default: true },
    { id: "organise", title: "Organise", description: "Tag messages with private labels and tuck chat-bar buttons away.", plugins: ["MessageTags", "Backpack"], default: false },
    { id: "cute", title: "Cute look", description: "A pink kawaii glass theme.", plugins: ["HelloKittyTheme"], default: false }
];

function applyPacks(chosen: Record<string, boolean>): boolean {
    let restartNeeded = false;
    for (const pack of PACKS) {
        if (!chosen[pack.id]) continue;
        for (const name of pack.plugins) {
            const p = plugins[name];
            if (!p || p.required || isPluginEnabled(name)) continue;
            Settings.plugins[name].enabled = true;
            if (pluginRequiresRestart(p)) restartNeeded = true;
            else if (!startPlugin(p)) restartNeeded = true;
        }
    }
    return restartNeeded;
}

function OnboardingModal({ rootProps }: { rootProps: any; }) {
    const [chosen, setChosen] = React.useState<Record<string, boolean>>(
        Object.fromEntries(PACKS.map(p => [p.id, p.default] as [string, boolean]))
    );

    function finish(apply: boolean) {
        set(SEEN_KEY, true);
        if (apply) {
            const restartNeeded = applyPacks(chosen);
            showToast("You're all set.", Toasts.Type.SUCCESS);
            if (restartNeeded) {
                showNotification({
                    title: "Almost done — restart to finish",
                    body: "Some of what you picked needs a restart. Click here to restart now.",
                    onClick: () => (IS_WEB ? location.reload() : relaunch())
                });
            }
        }
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Welcome to Kittycord 🐱</Text>
                <ModalCloseButton onClick={() => finish(false)} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-md/normal" style={{ margin: "12px 0" }}>
                    Pick what you'd like turned on. You can change any of this later in Settings → Plugins.
                </Text>

                {PACKS.map(pack => (
                    <FormSwitch
                        key={pack.id}
                        title={pack.title}
                        description={pack.description}
                        value={chosen[pack.id]}
                        onChange={v => setChosen(c => ({ ...c, [pack.id]: v }))}
                    />
                ))}

                <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "12px 0" }}>
                    Tip: open the toolbox above the chat bar for Modes and “Share setup with a friend”.
                </Text>

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "8px 0 16px" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => finish(false)}>Skip</Button>
                    <Button color={Button.Colors.BRAND} onClick={() => finish(true)}>Apply &amp; finish</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function openOnboarding() {
    openModal(props => <OnboardingModal rootProps={props} />);
}

let timer: ReturnType<typeof setTimeout> | null = null;

export default definePlugin({
    name: "Onboarding",
    description: "A friendly first-run setup that helps you turn on the Kittycord features you want.",
    authors: [{ name: "Kittycord", id: 0n }],
    enabledByDefault: true,

    toolboxActions: {
        "Run setup wizard"() {
            openOnboarding();
        }
    },

    async start() {
        if (await get(SEEN_KEY)) return;
        timer = setTimeout(openOnboarding, 4000);
    },

    stop() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }
});
