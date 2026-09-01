/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled, plugins } from "@api/PluginManager";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { copyWithToast } from "@utils/discord";
import type { Guild, RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, showToast, TextInput, Toasts, useMemo, UserStore,useState } from "@webpack/common";

import { settings as commandSettings } from "../commandStudio/settings";
import { getThemes, loadThemes } from "../kittycordStudio/store";
import { settings as soundSettings } from "../soundStudio/store";
import { importablePlugin, kitLink, ServerKit } from "./kit";
import { Native } from "./native-bridge";

function candidatePlugins() {
    return Object.values(plugins)
        .filter(p => importablePlugin(p.name) && isPluginEnabled(p.name))
        .map(p => p.name)
        .sort();
}

function KitDialog({ modalProps, guild }: { modalProps: RenderModalProps; guild: Guild; }) {
    const [name, setName] = useState(`${guild.name} starter kit`);
    const [themeFile, setThemeFile] = useState<string | null>(null);
    const [includeCommands, setIncludeCommands] = useState(true);
    const [includeSounds, setIncludeSounds] = useState(true);
    const [chosenPlugins, setChosenPlugins] = useState<string[]>([]);
    const [link, setLink] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const themes = useMemo(() => Object.entries(getThemes()), []);
    const available = useMemo(candidatePlugins, []);

    const commands = Object.values(commandSettings.store.commands);
    const sounds = soundSettings.store.rules.filter(r => r.targetId === guild.id || r.scope === "channel");

    function build(): ServerKit | null {
        const kit: ServerKit = { v: 1, name: name.trim(), guildName: guild.name };

        if (themeFile) {
            const params = themes.find(([file]) => file === themeFile)?.[1];
            if (params) kit.theme = params;
        }
        if (includeCommands && commands.length) kit.commands = commands;
        if (includeSounds && sounds.length)
            kit.sounds = sounds
                .filter(r => r.sound.kind === "curated")
                .map(r => ({
                    scope: r.scope === "friend" ? "user" as const : r.scope as "channel" | "guild",
                    targetId: r.targetId,
                    sound: r.sound.kind === "curated" ? r.sound.id : ""
                }));
        if (chosenPlugins.length) kit.plugins = chosenPlugins;

        if (!kit.theme && !kit.commands && !kit.sounds?.length && !kit.plugins) return null;
        return kit;
    }

    async function publish() {
        const kit = build();
        if (!kit) return showToast("Pick at least one thing to put in the kit.", Toasts.Type.FAILURE);
        if (!Native) return showToast("Kits are only available in the desktop app.", Toasts.Type.FAILURE);

        setBusy(true);
        const result = await Native.publishKit(UserStore.getCurrentUser()?.id ?? "", kit);
        setBusy(false);

        if (!result.ok) return showToast(result.error, Toasts.Type.FAILURE);
        setLink(kitLink(result.id));
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title="Create a server kit"
            subtitle={`Everyone in ${guild.name} who uses Kittycord can apply this in one click.`}
            actions={link ? [
                {
                    text: "Copy the link",
                    variant: "primary",
                    onClick: () => copyWithToast(link, "Link copied. Paste it into your server description.")
                },
                { text: "Done", variant: "secondary", onClick: modalProps.onClose }
            ] : [
                { text: "Cancel", variant: "secondary", onClick: modalProps.onClose },
                { text: busy ? "Publishing…" : "Publish", variant: "primary", disabled: busy, onClick: publish }
            ]}
        >
            {link ? (
                <Flex flexDirection="column" gap={12}>
                    <Paragraph>
                        Your kit is live. Paste this link into your server description, and members running Kittycord
                        get the offer when they open the server. Everyone else lands on a page that shows what is in it.
                    </Paragraph>
                    <TextInput value={link} onChange={() => { }} />
                </Flex>
            ) : (
                <Flex flexDirection="column" gap={12}>
                    <section>
                        <HeadingSecondary>Name</HeadingSecondary>
                        <TextInput value={name} onChange={setName} maxLength={60} />
                    </section>

                    <section>
                        <HeadingSecondary>Theme</HeadingSecondary>
                        {themes.length === 0 ? (
                            <Paragraph size="sm" style={{ color: "var(--text-muted)" }}>
                                Build one in Theme Studio first and it shows up here.
                            </Paragraph>
                        ) : (
                            <Flex gap={4} style={{ flexWrap: "wrap" }}>
                                <Button
                                    variant={themeFile === null ? "primary" : "secondary"}
                                    size="small"
                                    onClick={() => setThemeFile(null)}
                                >
                                    No theme
                                </Button>
                                {themes.map(([file, params]) => (
                                    <Button
                                        key={file}
                                        variant={themeFile === file ? "primary" : "secondary"}
                                        size="small"
                                        onClick={() => setThemeFile(file)}
                                    >
                                        {params.name}
                                    </Button>
                                ))}
                            </Flex>
                        )}
                    </section>

                    <FormSwitch
                        title={`Your ${commands.length} chat command${commands.length === 1 ? "" : "s"}`}
                        description="Personal things like where a command may run and any files it sends stay with you."
                        value={includeCommands && commands.length > 0}
                        disabled={commands.length === 0}
                        onChange={setIncludeCommands}
                        hideBorder
                    />

                    <FormSwitch
                        title={`${sounds.length} notification sound rule${sounds.length === 1 ? "" : "s"}`}
                        description="Only the built-in sounds travel, never files you uploaded yourself."
                        value={includeSounds && sounds.length > 0}
                        disabled={sounds.length === 0}
                        onChange={setIncludeSounds}
                        hideBorder
                    />

                    <section>
                        <HeadingSecondary>Recommended plugins</HeadingSecondary>
                        <Paragraph size="sm" style={{ color: "var(--text-muted)" }}>
                            Members choose whether to turn these on.
                        </Paragraph>
                        <Flex gap={4} style={{ flexWrap: "wrap", marginTop: 6 }}>
                            {available.map(pluginName => (
                                <Button
                                    key={pluginName}
                                    variant={chosenPlugins.includes(pluginName) ? "primary" : "secondary"}
                                    size="small"
                                    onClick={() => setChosenPlugins(list =>
                                        list.includes(pluginName) ? list.filter(p => p !== pluginName) : [...list, pluginName])}
                                >
                                    {pluginName}
                                </Button>
                            ))}
                        </Flex>
                    </section>
                </Flex>
            )}
        </Modal>
    );
}

export function openKitStudio(guild: Guild) {
    loadThemes().then(() => openModal(modalProps => <KitDialog modalProps={modalProps} guild={guild} />));
}
