/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { InlineCode } from "@components/CodeBlock";
import { ExpandableSection } from "@components/ExpandableCard";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { DeleteIcon, InfoIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { chooseFile } from "@utils/web";
import { RenderModalProps } from "@vencord/discord-types";
import { GuildStore, Modal, openModal, Select, showToast, TextArea, TextInput, Toasts, useMemo, useState } from "@webpack/common";

import { expand, PLACEHOLDERS, splitSteps } from "./placeholders";
import { addCommand, categories, CommandScope, CustomCommand, getCommand, importCommands, MAX_ALIASES, MAX_CATEGORY, MAX_DESCRIPTION, removeCommand, settings, SLASH_NAME_RE, takenNames } from "./settings";
import { addFile, getFile, MAX_FILE_BYTES, removeFile, StoredFile } from "./store";

const EXAMPLE_RESPONSE = "Hallo {1|zusammen}, wann hättest du Zeit? Vorschlag: {args}";
const EMPTY: CustomCommand = { trigger: "", message: "", mode: "send" };

export function openCommandModal(initialValue: CustomCommand = EMPTY) {
    openModal(modalProps => (
        <CommandDialog initialValue={initialValue} modalProps={modalProps} />
    ));
}

export function openImportModal() {
    openModal(modalProps => <ImportDialog modalProps={modalProps} />);
}

function ImportDialog({ modalProps }: { modalProps: RenderModalProps; }) {
    const [code, setCode] = useState("");

    const parsed = importCommands(code);
    const notice = code.trim() && !parsed ? "That isn't a valid command pack." : undefined;

    return (
        <Modal
            {...modalProps}
            title="Import commands"
            subtitle="Paste a command pack someone shared with you."
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: "Import",
                    variant: "primary",
                    onClick: () => {
                        if (!parsed) return;
                        parsed.forEach(addCommand);
                        showToast(`Imported ${parsed.length} command${parsed.length === 1 ? "" : "s"}.`, Toasts.Type.SUCCESS);
                        modalProps.onClose();
                    },
                    disabled: !parsed
                }
            ]}
            notice={notice ? { message: notice, type: "critical" } : undefined}
        >
            <Flex flexDirection="column" gap={12}>
                <section>
                    <HeadingSecondary>Command pack</HeadingSecondary>
                    <TextArea value={code} onChange={setCode} placeholder="KCMD2:..." autosize />
                </section>
                {parsed && (
                    <Paragraph>Ready to import {parsed.length} command{parsed.length === 1 ? "" : "s"}. Any with the same trigger will be replaced.</Paragraph>
                )}
            </Flex>
        </Modal>
    );
}

function scopeKindOf(scope?: CommandScope) {
    return scope?.kind ?? "everywhere";
}

function AttachmentRow({ id, onRemove }: { id: string; onRemove(): void; }) {
    const file = getFile(id);
    if (!file) return null;

    return (
        <Flex alignItems="center" gap={8}>
            <Paragraph size="sm">{file.name}</Paragraph>
            <Button variant="dangerSecondary" size="iconOnly" onClick={onRemove}>
                <DeleteIcon aria-label="Remove file" width={16} height={16} />
            </Button>
        </Flex>
    );
}

function CommandDialog({ initialValue, modalProps }: { initialValue: CustomCommand; modalProps: RenderModalProps; }) {
    const [trigger, setTrigger] = useState(initialValue.trigger);
    const [message, setMessage] = useState(initialValue.message.replaceAll("\\n", "\n"));
    const [description, setDescription] = useState(initialValue.description ?? "");
    const [aliasText, setAliasText] = useState((initialValue.aliases ?? []).join(", "));
    const [category, setCategory] = useState(initialValue.category ?? "");
    const [scopeKind, setScopeKind] = useState(scopeKindOf(initialValue.scope));
    const [guildIds, setGuildIds] = useState(initialValue.scope?.kind === "guilds" ? initialValue.scope.guildIds : []);
    const [attachments, setAttachments] = useState(initialValue.attachments ?? []);
    const [slash, setSlash] = useState(initialValue.slash !== false);
    const [insertMode, setInsertMode] = useState(initialValue.mode === "insert");

    const isEdit = Boolean(initialValue.trigger);
    const prefix = settings.store.prefix.trim() || ".";
    const cleanTrigger = trigger.startsWith(prefix) ? trigger.slice(prefix.length) : trigger;

    const aliases = aliasText.split(",").map(a => a.trim()).filter(Boolean).slice(0, MAX_ALIASES);
    const taken = useMemo(() => takenNames(initialValue.trigger), [initialValue.trigger]);

    const hasWhitespace = /\s/.test(cleanTrigger) || aliases.some(a => /\s/.test(a));
    const clashingAlias = aliases.find(a => taken.has(a.toLowerCase()) || a.toLowerCase() === cleanTrigger.toLowerCase());
    const alreadyExists = cleanTrigger.toLowerCase() !== initialValue.trigger.toLowerCase() && getCommand(cleanTrigger);

    const notice = hasWhitespace
        ? "Triggers and aliases cannot contain spaces."
        : clashingAlias
            ? `"${clashingAlias}" is already used by another command.`
            : alreadyExists
                ? `A command "${prefix}${cleanTrigger}" already exists and will be overwritten.`
                : undefined;

    const guilds = useMemo(() => Object.values(GuildStore.getGuilds()).map(g => ({ label: g.name, value: g.id })), []);
    const knownCategories = useMemo(categories, []);

    const preview = useMemo(() => splitSteps(expand(message, {
        args: "Max morgen",
        channelId: "0",
        channelMention: "#general",
        guildName: "Your server",
        selfId: "0",
        replyAuthor: "Robin",
        replyText: "sounds good",
        clipboard: "whatever you copied",
        useCount: 7,
        now: new Date(),
        random: () => 0.42
    })), [message]);

    const slashPossible = SLASH_NAME_RE.test(cleanTrigger.toLowerCase());

    async function pickFile() {
        const file = await chooseFile("*/*");
        if (!file) return;

        const result = await addFile(file);
        if ("error" in result) return showToast(result.error, Toasts.Type.FAILURE);

        setAttachments(list => [...list, result.id]);
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={isEdit ? "Edit Command" : "Create Command"}
            subtitle={isEdit ? "Edit your custom command." : "Type its trigger in chat to send the message below."}
            actions={[
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: modalProps.onClose
                },
                {
                    text: isEdit ? "Save" : "Create",
                    variant: "primary",
                    onClick: () => {
                        if (isEdit && initialValue.trigger.toLowerCase() !== cleanTrigger.toLowerCase())
                            removeCommand(initialValue.trigger);

                        const scope: CommandScope = scopeKind === "guilds"
                            ? { kind: "guilds", guildIds }
                            : { kind: scopeKind as "everywhere" | "dms" };

                        const command: CustomCommand = {
                            trigger: cleanTrigger,
                            message,
                            mode: insertMode ? "insert" : "send"
                        };

                        if (description.trim()) command.description = description.trim().slice(0, MAX_DESCRIPTION);
                        if (aliases.length) command.aliases = aliases;
                        if (category.trim()) command.category = category.trim().slice(0, MAX_CATEGORY);
                        if (scope.kind !== "everywhere") command.scope = scope;
                        if (attachments.length) command.attachments = attachments;
                        if (!slash) command.slash = false;

                        addCommand(command);
                        modalProps.onClose();
                    },
                    disabled: !cleanTrigger || !message || hasWhitespace || Boolean(clashingAlias)
                }
            ]}
            notice={notice ? { message: notice, type: "critical" } : undefined}
        >
            <Flex flexDirection="column" gap={12}>
                <section>
                    <HeadingSecondary>Trigger</HeadingSecondary>
                    <TextInput value={trigger} onChange={setTrigger} placeholder="termin" />
                </section>

                <section>
                    <HeadingSecondary>What it does</HeadingSecondary>
                    <TextInput value={description} onChange={setDescription} placeholder="Asks someone for a time" maxLength={MAX_DESCRIPTION} />
                </section>

                <section>
                    <HeadingSecondary>Message</HeadingSecondary>
                    <TextArea value={message} onChange={setMessage} placeholder={EXAMPLE_RESPONSE} autosize rows={4} />
                    <Flex gap={4} style={{ marginTop: 8, flexWrap: "wrap" }}>
                        {PLACEHOLDERS.map(p => (
                            <Button
                                key={p.token}
                                variant="secondary"
                                size="small"
                                onClick={() => setMessage(m => `${m}${p.token}`)}
                            >
                                {p.token}
                            </Button>
                        ))}
                    </Flex>
                </section>

                {preview.length > 0 && (
                    <section>
                        <HeadingSecondary>Preview</HeadingSecondary>
                        <Paragraph size="sm" style={{ color: "var(--text-muted)" }}>
                            With <InlineCode>{`${prefix}${cleanTrigger || "termin"} Max morgen`}</InlineCode>
                            {preview.length > 1 ? `, sent as ${preview.length} messages:` : ":"}
                        </Paragraph>
                        {preview.map((step, i) => (
                            <Paragraph key={i} size="sm" style={{ whiteSpace: "pre-wrap" }}>{step}</Paragraph>
                        ))}
                    </section>
                )}

                <section>
                    <HeadingSecondary>Other names for it</HeadingSecondary>
                    <TextInput value={aliasText} onChange={setAliasText} placeholder="t, meeting" />
                    <Paragraph size="sm" style={{ color: "var(--text-muted)" }}>
                        Separate with commas, up to {MAX_ALIASES}.
                    </Paragraph>
                </section>

                <section>
                    <HeadingSecondary>Category</HeadingSecondary>
                    <TextInput value={category} onChange={setCategory} placeholder="Work" maxLength={MAX_CATEGORY} />
                    {knownCategories.length > 0 && (
                        <Flex gap={4} style={{ marginTop: 6, flexWrap: "wrap" }}>
                            {knownCategories.map(c => (
                                <Button key={c} variant="secondary" size="small" onClick={() => setCategory(c)}>{c}</Button>
                            ))}
                        </Flex>
                    )}
                </section>

                <section>
                    <HeadingSecondary>Where it works</HeadingSecondary>
                    <Select
                        options={[
                            { label: "Everywhere", value: "everywhere" },
                            { label: "Only in DMs", value: "dms" },
                            { label: "Only in chosen servers", value: "guilds" }
                        ]}
                        select={v => setScopeKind(v)}
                        isSelected={v => scopeKind === v}
                        serialize={String}
                    />
                    {scopeKind === "guilds" && (
                        <Flex gap={4} style={{ marginTop: 8, flexWrap: "wrap" }}>
                            {guilds.map(g => (
                                <Button
                                    key={g.value}
                                    variant={guildIds.includes(g.value) ? "primary" : "secondary"}
                                    size="small"
                                    onClick={() => setGuildIds(ids => ids.includes(g.value) ? ids.filter(i => i !== g.value) : [...ids, g.value])}
                                >
                                    {g.label}
                                </Button>
                            ))}
                        </Flex>
                    )}
                </section>

                <section>
                    <HeadingSecondary>Files it sends along</HeadingSecondary>
                    <Paragraph size="sm" style={{ color: "var(--text-muted)" }}>
                        Files are put into the chat box together with the text, so you send them yourself with Enter.
                        Up to {Math.round(MAX_FILE_BYTES / 1_000_000)} MB each, and they are not part of shared packs.
                    </Paragraph>
                    {attachments.map(id => (
                        <AttachmentRow
                            key={id}
                            id={id}
                            onRemove={() => {
                                setAttachments(list => list.filter(a => a !== id));
                                removeFile(id);
                            }}
                        />
                    ))}
                    <Button variant="secondary" size="small" onClick={pickFile} style={{ marginTop: 6 }}>Add a file</Button>
                </section>

                <FormSwitch
                    title="Offer it in Discord's slash menu"
                    description={slashPossible
                        ? "Type / and the trigger to see it listed with its description."
                        : "Only triggers made of letters, numbers, dashes and underscores can appear there."}
                    value={slash && slashPossible}
                    disabled={!slashPossible}
                    onChange={setSlash}
                    hideBorder
                />

                <FormSwitch
                    title="Put the message in the chat box instead of sending it"
                    description="Lets you review or edit the expanded text before you hit enter."
                    value={insertMode}
                    onChange={setInsertMode}
                    hideBorder
                />

                <ExpandableSection
                    renderContent={() => (
                        <Flex flexDirection="column" gap={8}>
                            {PLACEHOLDERS.map(p => (
                                <Paragraph key={p.token}><InlineCode>{p.token}</InlineCode> {p.label}</Paragraph>
                            ))}
                            <Paragraph>
                                A line containing only <InlineCode>---</InlineCode> splits the template into several
                                messages, sent one after another.
                            </Paragraph>
                            <Paragraph>
                                If your message uses none of the argument placeholders but you still type extra text, it
                                gets added to the end.
                            </Paragraph>
                        </Flex>
                    )}
                >
                    <Flex alignItems="center" gap={8}>
                        <InfoIcon color="var(--text-muted)" height={16} width={16} />
                        View placeholder guide
                    </Flex>
                </ExpandableSection>
            </Flex>
        </Modal>
    );
}

export type { StoredFile };
