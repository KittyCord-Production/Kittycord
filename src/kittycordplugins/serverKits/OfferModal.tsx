/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, pluginRequiresRestart, plugins, startPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { FormSwitch } from "@components/FormSwitch";
import { Paragraph } from "@components/Paragraph";
import { relaunch } from "@utils/native";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, showToast, Toasts, useState } from "@webpack/common";

import { addCommand, getCommand } from "../commandStudio/settings";
import { enableTheme, saveTheme } from "../kittycordStudio/store";
import { PreviewPane } from "../kittycordStudio/StudioModal";
import { addRule } from "../soundStudio/store";
import { ServerKit } from "./kit";

interface Picks {
    theme: boolean;
    commands: boolean;
    sounds: boolean;
    plugins: boolean;
}

function applyPlugins(names: string[]) {
    let restartNeeded = false;

    for (const name of names) {
        const plugin = plugins[name];
        if (!plugin || plugin.required || isPluginEnabled(name)) continue;

        Settings.plugins[name].enabled = true;
        if (pluginRequiresRestart(plugin)) restartNeeded = true;
        else if (!startPlugin(plugin)) restartNeeded = true;
    }

    return restartNeeded;
}

function OfferDialog({ modalProps, kit, onDecided }: {
    modalProps: RenderModalProps;
    kit: ServerKit;
    onDecided(decision: "applied" | "later" | "never"): void;
}) {
    const [picks, setPicks] = useState<Picks>({ theme: true, commands: true, sounds: true, plugins: true });
    const [busy, setBusy] = useState(false);

    const clashes = (kit.commands ?? []).filter(c => getCommand(c.trigger));

    async function apply() {
        setBusy(true);
        let restartNeeded = false;

        try {
            if (kit.theme && picks.theme) {
                const file = await saveTheme(kit.theme);
                enableTheme(file);
            }

            if (kit.commands && picks.commands) kit.commands.forEach(addCommand);

            if (kit.sounds && picks.sounds)
                for (const rule of kit.sounds)
                    addRule({
                        scope: rule.scope === "user" ? "friend" : rule.scope,
                        targetId: rule.targetId,
                        sound: { kind: "curated", id: rule.sound },
                        volume: 1
                    });

            if (kit.plugins && picks.plugins) restartNeeded = applyPlugins(kit.plugins);

            showToast(`Applied "${kit.name}".`, Toasts.Type.SUCCESS);
            onDecided("applied");
            modalProps.onClose();

            if (restartNeeded) {
                showToast("Restart Discord to finish turning those plugins on.", Toasts.Type.MESSAGE);
                setTimeout(() => (IS_WEB ? location.reload() : relaunch()), 2500);
            }
        } catch {
            setBusy(false);
            showToast("Could not apply that kit.", Toasts.Type.FAILURE);
        }
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={kit.name}
            subtitle={kit.guildName ? `${kit.guildName} put this together for its members.` : "A server put this together for its members."}
            notice={clashes.length ? { message: `${clashes.length} of your own commands share a trigger and would be replaced.`, type: "critical" } : undefined}
            actions={[
                {
                    text: "Never for this server",
                    variant: "secondary",
                    onClick: () => { onDecided("never"); modalProps.onClose(); }
                },
                {
                    text: "Not now",
                    variant: "secondary",
                    onClick: () => { onDecided("later"); modalProps.onClose(); }
                },
                {
                    text: busy ? "Applying…" : "Apply",
                    variant: "primary",
                    disabled: busy,
                    onClick: apply
                }
            ]}
        >
            {kit.theme && (
                <>
                    <FormSwitch
                        title="Their theme"
                        description="Saved to your themes and switched on. Your other themes stay where they are."
                        value={picks.theme}
                        onChange={v => setPicks(p => ({ ...p, theme: v }))}
                        hideBorder
                    />
                    <PreviewPane params={kit.theme} />
                </>
            )}

            {kit.commands?.length ? (
                <FormSwitch
                    title={`${kit.commands.length} chat command${kit.commands.length === 1 ? "" : "s"}`}
                    description={kit.commands.map(c => c.trigger).join(", ")}
                    value={picks.commands}
                    onChange={v => setPicks(p => ({ ...p, commands: v }))}
                    hideBorder
                />
            ) : null}

            {kit.sounds?.length ? (
                <FormSwitch
                    title={`${kit.sounds.length} notification sound${kit.sounds.length === 1 ? "" : "s"}`}
                    description="Sets which sound plays for this server's channels and people."
                    value={picks.sounds}
                    onChange={v => setPicks(p => ({ ...p, sounds: v }))}
                    hideBorder
                />
            ) : null}

            {kit.plugins?.length ? (
                <FormSwitch
                    title={`${kit.plugins.length} recommended plugin${kit.plugins.length === 1 ? "" : "s"}`}
                    description={kit.plugins.join(", ")}
                    value={picks.plugins}
                    onChange={v => setPicks(p => ({ ...p, plugins: v }))}
                    hideBorder
                />
            ) : null}

            <Paragraph size="sm" style={{ color: "var(--text-muted)", marginTop: 12 }}>
                Nothing here is applied until you press Apply, and you can undo any of it afterwards.
            </Paragraph>
        </Modal>
    );
}

export function openOfferModal(kit: ServerKit, onDecided: (decision: "applied" | "later" | "never") => void) {
    openModal(modalProps => <OfferDialog modalProps={modalProps} kit={kit} onDecided={onDecided} />);
}
