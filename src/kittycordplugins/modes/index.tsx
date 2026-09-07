/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { ErrorBoundary } from "@components/index";
import { ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin, { OptionType } from "@utils/types";
import type { Message, RenderModalProps } from "@vencord/discord-types";
import { Alerts, Button, GuildStore, React, SearchableSelect, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";

import { ModalCloseButton, ModalContent, ModalHeader, ModalRoot } from "../_shared/modal";
import { ShareFileModal } from "../_shared/ShareFileModal";
import { buildModeFile, fetchMode, findModeAttachment } from "./share";
import { applyMode, type AutoTrigger, captureInto, currentThemes, deleteMode, getActiveId, getModes, getTogglablePlugins, loadModes, type Mode, newMode, notifyManualActivation, runningGameNames, saveMode, startAuto, type StatusValue, stopAuto } from "./utils";

const settings = definePluginSettings({
    autoSwitch: {
        type: OptionType.BOOLEAN,
        description: "Let modes switch themselves based on their triggers (time of day, running game, open server)",
        default: true,
        onChange: () => (settings.store.autoSwitch ? startAuto() : stopAuto())
    }
});

const AUTO_OPTIONS = [
    { label: "Don't auto-switch", value: "" },
    { label: "At a time of day", value: "time" },
    { label: "When playing a game", value: "game" },
    { label: "When a server is open", value: "guild" }
];

const STATUS_OPTIONS = [
    { label: "Don't change", value: "" },
    { label: "Online", value: "online" },
    { label: "Idle", value: "idle" },
    { label: "Do Not Disturb", value: "dnd" },
    { label: "Invisible", value: "invisible" }
];

function Label({ children }: { children: string; }) {
    return <Text variant="text-sm/semibold" style={{ marginBottom: 4, marginTop: 12 }}>{children}</Text>;
}

function ModeEditor({ rootProps, initial, onSaved }: { rootProps: RenderModalProps; initial: Mode; onSaved(): void; }) {
    const [name, setName] = React.useState(initial.name);
    const [emoji, setEmoji] = React.useState(initial.emoji ?? "");
    const [status, setStatus] = React.useState<string>(initial.status ?? "");
    const [csOn, setCsOn] = React.useState(initial.customStatus !== undefined);
    const [csText, setCsText] = React.useState(initial.customStatus?.text ?? "");
    const [withThemes, setWithThemes] = React.useState(initial.themes !== undefined);
    const [themes, setThemes] = React.useState<string[]>(initial.themes ?? currentThemes());
    const [pluginMap, setPluginMap] = React.useState<Record<string, boolean>>(initial.plugins ?? {});
    const [autoKind, setAutoKind] = React.useState<string>(initial.auto?.kind ?? "");
    const [timeStart, setTimeStart] = React.useState(initial.auto?.kind === "time" ? initial.auto.start : "23:00");
    const [timeEnd, setTimeEnd] = React.useState(initial.auto?.kind === "time" ? initial.auto.end : "07:00");
    const [games, setGames] = React.useState<string[]>(initial.auto?.kind === "game" ? initial.auto.games : []);
    const [gameDraft, setGameDraft] = React.useState("");
    const [guildIds, setGuildIds] = React.useState<string[]>(initial.auto?.kind === "guild" ? initial.auto.guildIds : []);
    const [isDefault, setIsDefault] = React.useState(!!initial.isDefault);

    const togglable = React.useMemo(getTogglablePlugins, []);
    const available = togglable.filter(o => !(o.value in pluginMap));
    const detectedGames = React.useMemo(runningGameNames, []);
    const guildOptions = React.useMemo(() => Object.values(GuildStore.getGuilds()).map(g => ({ value: g.id, label: g.name })).sort((a, b) => a.label.localeCompare(b.label)), []);
    const guildAvailable = guildOptions.filter(o => !guildIds.includes(o.value));

    function addGame() {
        const g = gameDraft.trim();
        if (g && !games.includes(g)) setGames([...games, g]);
        setGameDraft("");
    }

    async function save() {
        let auto: AutoTrigger | undefined;
        if (autoKind === "time") auto = { kind: "time", start: timeStart.trim(), end: timeEnd.trim() };
        else if (autoKind === "game" && games.length) auto = { kind: "game", games };
        else if (autoKind === "guild" && guildIds.length) auto = { kind: "guild", guildIds };

        const mode: Mode = {
            ...initial,
            name: name.trim() || "Untitled mode",
            emoji: emoji.trim() || undefined,
            status: status ? (status as StatusValue) : undefined,
            customStatus: csOn ? (csText.trim() ? { text: csText.trim() } : null) : undefined,
            themes: withThemes ? themes : undefined,
            plugins: Object.keys(pluginMap).length ? pluginMap : undefined,
            auto,
            isDefault: isDefault || undefined
        };
        await saveMode(mode);
        onSaved();
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Edit mode</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Flex style={{ gap: 8, marginTop: 12 }}>
                    <div style={{ width: 64 }}>
                        <Label>Emoji</Label>
                        <TextInput value={emoji} onChange={setEmoji} placeholder="🐱" maxLength={8} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <Label>Name</Label>
                        <TextInput value={name} onChange={setName} placeholder="Work, Gaming, Focus…" />
                    </div>
                </Flex>

                <Label>Online status</Label>
                <SearchableSelect options={STATUS_OPTIONS} value={status} onChange={(v: string) => setStatus(v)} closeOnSelect />

                <FormSwitch
                    title="Change custom status"
                    description="Leave the text empty to clear your custom status."
                    value={csOn}
                    onChange={setCsOn}
                />
                {csOn && <TextInput value={csText} onChange={setCsText} placeholder="Custom status text" />}

                <FormSwitch
                    title="Switch themes with this mode"
                    description={withThemes ? `Will enable ${themes.length} theme(s).` : "Themes stay as they are."}
                    value={withThemes}
                    onChange={setWithThemes}
                />
                {withThemes && (
                    <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} color={Button.Colors.LINK} onClick={() => setThemes(currentThemes())}>
                        Re-capture from current themes
                    </Button>
                )}

                <Label>Plugins this mode toggles</Label>
                {Object.entries(pluginMap).map(([n, want]) => (
                    <Flex key={n} style={{ gap: 8, alignItems: "center", padding: "4px 0" }}>
                        <Text variant="text-sm/normal" style={{ flex: 1 }}>{n}</Text>
                        <FormSwitch hideBorder title={want ? "On" : "Off"} value={want} onChange={v => setPluginMap(m => ({ ...m, [n]: v }))} />
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => setPluginMap(m => { const x = { ...m }; delete x[n]; return x; })}>Remove</Button>
                    </Flex>
                ))}
                <div style={{ marginTop: 4 }}>
                    <SearchableSelect options={available} value={undefined} placeholder="Add a plugin…" onChange={(v: string) => setPluginMap(m => ({ ...m, [v]: true }))} closeOnSelect />
                </div>

                <Label>Auto-switch to this mode</Label>
                <SearchableSelect options={AUTO_OPTIONS} value={autoKind} onChange={(v: string) => setAutoKind(v)} closeOnSelect />

                {autoKind === "time" && (
                    <Flex style={{ gap: 8, marginTop: 8 }}>
                        <div style={{ flex: 1 }}>
                            <Label>From</Label>
                            <TextInput value={timeStart} onChange={setTimeStart} placeholder="23:00" maxLength={5} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <Label>Until</Label>
                            <TextInput value={timeEnd} onChange={setTimeEnd} placeholder="07:00" maxLength={5} />
                        </div>
                    </Flex>
                )}

                {autoKind === "game" && (
                    <>
                        {games.map(g => (
                            <Flex key={g} style={{ gap: 8, alignItems: "center", padding: "4px 0" }}>
                                <Text variant="text-sm/normal" style={{ flex: 1 }}>{g}</Text>
                                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => setGames(games.filter(x => x !== g))}>Remove</Button>
                            </Flex>
                        ))}
                        <Flex style={{ gap: 8, marginTop: 4 }}>
                            <div style={{ flex: 1 }}>
                                <TextInput value={gameDraft} onChange={setGameDraft} placeholder="Game name, e.g. League of Legends" />
                            </div>
                            <Button size={Button.Sizes.SMALL} onClick={addGame}>Add</Button>
                        </Flex>
                        {detectedGames.length > 0 && (
                            <Text variant="text-xs/normal" style={{ opacity: 0.6, marginTop: 4 }}>Detected right now: {detectedGames.join(", ")}</Text>
                        )}
                    </>
                )}

                {autoKind === "guild" && (
                    <>
                        {guildIds.map(id => (
                            <Flex key={id} style={{ gap: 8, alignItems: "center", padding: "4px 0" }}>
                                <Text variant="text-sm/normal" style={{ flex: 1 }}>{GuildStore.getGuild(id)?.name ?? "Unknown server"}</Text>
                                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={() => setGuildIds(guildIds.filter(x => x !== id))}>Remove</Button>
                            </Flex>
                        ))}
                        <div style={{ marginTop: 4 }}>
                            <SearchableSelect options={guildAvailable} value={undefined} placeholder="Add a server…" onChange={(v: string) => setGuildIds([...guildIds, v])} closeOnSelect />
                        </div>
                    </>
                )}

                <FormSwitch
                    title="Use as default mode"
                    description="Switch back to this mode when no auto-rule matches."
                    value={isDefault}
                    onChange={setIsDefault}
                />

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} onClick={save}>Save mode</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function describeMode(mode: Mode, missingPlugins: string[]) {
    const parts: string[] = [];
    if (mode.status) parts.push(`status: ${mode.status}`);
    if (mode.customStatus?.text) parts.push("a custom status");
    if (mode.themes?.length) parts.push(`${mode.themes.length} theme(s)`);
    if (mode.plugins) parts.push(`${Object.keys(mode.plugins).length} plugin toggle(s)`);
    return (
        <div style={{ textAlign: "left" }}>
            <Text variant="text-md/normal">
                "{mode.emoji ? mode.emoji + " " : ""}{mode.name}" changes: {parts.length ? parts.join(", ") : "nothing yet"}.
            </Text>
            {missingPlugins.length > 0 && (
                <Text variant="text-sm/normal" style={{ opacity: 0.8, marginTop: 8 }}>
                    {missingPlugins.length} plugin(s) in this mode aren't available here and will be skipped: {missingPlugins.join(", ")}
                </Text>
            )}
        </div>
    );
}

function ModeImportCardInner({ message }: { message: Message; }) {
    const attachment = findModeAttachment(message.attachments);
    const own = message.author?.id === UserStore.getCurrentUser()?.id;
    if (!attachment) return null;

    async function startImport() {
        try {
            const { mode, sender, missingPlugins } = await fetchMode(attachment!);
            Alerts.show({
                title: own ? "Add your shared mode?" : `Add ${sender}'s mode?`,
                body: describeMode(mode, missingPlugins),
                confirmText: "Add & activate",
                secondaryConfirmText: "Just add",
                cancelText: "Cancel",
                onConfirm: async () => {
                    await saveMode(mode);
                    notifyManualActivation();
                    const { restartNeeded } = await applyMode(mode);
                    showToast(`Switched to "${mode.name}".`, Toasts.Type.SUCCESS);
                    if (restartNeeded) {
                        showNotification({
                            title: "Mode applied — restart needed",
                            body: "Some plugins in this mode need a restart to fully apply. Click to restart now.",
                            onClick: () => (IS_WEB ? location.reload() : relaunch())
                        });
                    }
                },
                onConfirmSecondary: async () => {
                    await saveMode(mode);
                    showToast(`Added "${mode.name}" to your modes.`, Toasts.Type.SUCCESS);
                }
            });
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not read that mode."), Toasts.Type.FAILURE);
        }
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, margin: "4px 0", borderRadius: 8, background: "var(--background-secondary)" }}>
            <Text variant="text-md/semibold" style={{ flex: 1 }}>
                🎛️ {own ? "Your shared Kittycord mode" : `${message.author?.username ?? "Someone"} shared a Kittycord mode`}
            </Text>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={startImport}>Add</Button>
        </div>
    );
}

const ModeImportCard = ErrorBoundary.wrap(ModeImportCardInner, { noop: true });

function triggerLabel(mode: Mode): string | null {
    const a = mode.auto;
    if (!a) return null;
    if (a.kind === "time") return `⏰ ${a.start}–${a.end}`;
    if (a.kind === "game") return `🎮 ${a.games.join(", ")}`;
    return `🏠 ${a.guildIds.map(id => GuildStore.getGuild(id)?.name ?? "server").join(", ")}`;
}

function ModesModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const modes = getModes();
    const activeId = getActiveId();

    async function activate(mode: Mode) {
        try {
            notifyManualActivation();
            const { restartNeeded } = await applyMode(mode);
            forceUpdate();
            showToast(`Switched to "${mode.name}".`, Toasts.Type.SUCCESS);
            if (restartNeeded) {
                showNotification({
                    title: "Mode applied — restart needed",
                    body: "Some plugins in this mode need a restart to fully apply. Click to restart now.",
                    onClick: () => (IS_WEB ? location.reload() : relaunch())
                });
            }
        } catch {
            showToast("Could not apply that mode.", Toasts.Type.FAILURE);
        }
    }

    function openEditor(mode: Mode) {
        openModal(props => <ModeEditor rootProps={props} initial={mode} onSaved={forceUpdate} />);
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Modes ({modes.length})</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {modes.length === 0
                    ? <Text variant="text-md/normal" style={{ padding: "16px 0" }}>No modes yet. Set up your client how you like it, then create one — it captures your status, custom status and themes.</Text>
                    : modes.map(mode => (
                        <Flex key={mode.id} style={{ gap: 8, alignItems: "center", padding: "8px 0" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="text-md/semibold">
                                    {mode.emoji ? mode.emoji + " " : ""}{mode.name}
                                    {mode.id === activeId && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>active</span>}
                                    {mode.isDefault && <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>default</span>}
                                </Text>
                                {triggerLabel(mode) && <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>{triggerLabel(mode)}</Text>}
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => activate(mode)}>Activate</Button>
                            <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => openEditor(mode)}>Edit</Button>
                            <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => openModal(props => (
                                <ShareFileModal
                                    rootProps={props}
                                    title={`Share "${mode.emoji ? mode.emoji + " " : ""}${mode.name}"`}
                                    blurb="Friends with Kittycord get a one-tap import card. Nothing personal is included — just the mode itself."
                                    buildFile={() => buildModeFile(mode)}
                                    defaultNote={`Here's my "${mode.name}" mode for Kittycord — add it with one tap!`}
                                />
                            ))}>Share</Button>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={async () => { await deleteMode(mode.id); forceUpdate(); }}>Delete</Button>
                        </Flex>
                    ))}

                <Flex style={{ marginTop: 16 }}>
                    <Button color={Button.Colors.BRAND} onClick={() => openEditor(captureInto(newMode("New mode")))}>+ New mode (captures current setup)</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "Modes",
    description: "Switch your whole Discord with one tap: status, custom status, themes and which plugins are on — bundled into named modes like Work, Gaming or Focus. Share modes with friends for one-tap import.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    dependencies: ["UserSettingsAPI", "MessageAccessoriesAPI"],
    settings,

    toolboxActions: {
        "Open Modes"() {
            openModal(props => <ModesModal rootProps={props} />);
        }
    },

    renderMessageAccessory({ message }) {
        if (!findModeAttachment(message.attachments)) return null;
        return <ModeImportCard message={message} />;
    },

    async start() {
        await loadModes();
        if (settings.store.autoSwitch) startAuto();
    },

    stop() {
        stopAuto();
    }
});
