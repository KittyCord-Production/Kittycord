/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { plugins } from "@api/PluginManager";
import { importSettings } from "@api/SettingsSync/offline";
import { ExpandableSection } from "@components/ExpandableCard";
import { FormSwitch } from "@components/FormSwitch";
import { Paragraph } from "@components/Paragraph";
import { relaunch } from "@utils/native";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, useEffect, useState } from "@webpack/common";

import { buildPayload, planPlugins, PluginPlan } from "./mapping";
import type { DetectedSource, SourceData } from "./native";

export const Native = VencordNative.pluginHelpers.SetupImport as {
    detectSources(): Promise<DetectedSource[]>;
    readSource(key: string): Promise<SourceData | null>;
    copyThemes(key: string, files: string[]): Promise<Record<string, string>>;
} | undefined;

const isKnownPlugin = (name: string) => {
    const plugin = plugins[name];
    return Boolean(plugin) && !plugin.required;
};

interface Choices {
    plugins: boolean;
    themes: boolean;
    quickCss: boolean;
}

function ImportDialog({ modalProps, source }: { modalProps: RenderModalProps; source: DetectedSource; }) {
    const [data, setData] = useState<SourceData | null>(null);
    const [plan, setPlan] = useState<PluginPlan | null>(null);
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [choices, setChoices] = useState<Choices>({ plugins: true, themes: true, quickCss: true });

    useEffect(() => {
        if (!Native) return setFailed(true);

        Native.readSource(source.key)
            .then(result => {
                if (!result) return setFailed(true);
                setData(result);
                setPlan(planPlugins(result.settings?.plugins, isKnownPlugin));
            })
            .catch(() => setFailed(true));
    }, [source.key]);

    const canPlugins = Boolean(plan?.matched.length);
    const canThemes = Boolean(data?.themes.length);
    const canQuickCss = Boolean(data?.quickCss?.trim());

    async function run() {
        if (!data || !Native) return;
        setBusy(true);

        try {
            const copied = choices.themes && canThemes
                ? await Native.copyThemes(source.key, data.themes)
                : null;

            const payload = buildPayload({
                source,
                sourceSettings: data.settings,
                plugins: choices.plugins && canPlugins ? plan : null,
                copiedThemes: copied,
                bdEnabledThemes: data.bdEnabledThemes,
                quickCss: choices.quickCss && canQuickCss ? data.quickCss : null,
                existingQuickCss: await VencordNative.quickCss.get()
            });

            await importSettings(JSON.stringify(payload), payload.settings ? "all" : "css");

            modalProps.onClose();
            showNotification({
                title: `Setup imported from ${source.displayName}`,
                body: "Click here to restart Discord and apply it.",
                onClick: () => (IS_WEB ? location.reload() : relaunch())
            });
        } catch {
            setBusy(false);
            setFailed(true);
        }
    }

    const nothingPicked = !(choices.plugins && canPlugins) && !(choices.themes && canThemes) && !(choices.quickCss && canQuickCss);

    return (
        <Modal
            {...modalProps}
            title={`Import from ${source.displayName}`}
            subtitle={`Nothing on the ${source.displayName} side is changed or removed.`}
            notice={failed ? { message: "That setup could not be read. The files may be in use by another app.", type: "critical" } : undefined}
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: busy ? "Importing…" : "Import and restart",
                    variant: "primary",
                    disabled: !data || busy || nothingPicked,
                    onClick: run
                }
            ]}
        >
            {!data && !failed && <Paragraph>Reading your {source.displayName} setup…</Paragraph>}

            {data && (
                <>
                    {source.kind === "betterdiscord" && (
                        <Paragraph>
                            BetterDiscord plugins are built for a different system, so they cannot come along. Your
                            themes and custom CSS can.
                        </Paragraph>
                    )}

                    <FormSwitch
                        value={choices.plugins && canPlugins}
                        disabled={!canPlugins}
                        onChange={v => setChoices(c => ({ ...c, plugins: v }))}
                        title={canPlugins ? `${plan!.matched.length} plugins and their settings` : "No plugins to bring over"}
                        description={plan?.skipped.length
                            ? `${plan.skipped.length} more do not exist in Kittycord and stay behind.`
                            : "Every plugin that also exists here keeps the settings you gave it."}
                    />

                    <FormSwitch
                        value={choices.themes && canThemes}
                        disabled={!canThemes}
                        onChange={v => setChoices(c => ({ ...c, themes: v }))}
                        title={canThemes ? `${data.themes.length} theme files` : "No themes found"}
                        description="Copied into your themes folder. The ones you had switched on replace the theme running now."
                    />

                    <FormSwitch
                        value={choices.quickCss && canQuickCss}
                        disabled={!canQuickCss}
                        onChange={v => setChoices(c => ({ ...c, quickCss: v }))}
                        title={canQuickCss ? "Your custom CSS" : "No custom CSS found"}
                        description="Added below the CSS you already have here, never on top of it."
                    />

                    {plan?.skipped.length ? (
                        <ExpandableSection renderContent={() => <Paragraph>{plan.skipped.join(", ")}</Paragraph>}>
                            Plugins that stay behind ({plan.skipped.length})
                        </ExpandableSection>
                    ) : null}
                </>
            )}
        </Modal>
    );
}

export function openImportModal(source: DetectedSource) {
    openModal(modalProps => <ImportDialog modalProps={modalProps} source={source} />);
}
