/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { InlineCode } from "@components/CodeBlock";
import { ExpandableSection } from "@components/ExpandableCard";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { HeadingSecondary } from "@components/Heading";
import { InfoIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, showToast, TextArea, TextInput, Toasts, useState } from "@webpack/common";

import { addCommand, CustomCommand, getCommand, importCommands, removeCommand, settings } from "./settings";

const EXAMPLE_RESPONSE = "Hallo, wann hättest du Zeit? Vorschlag: {args}";

export function openCommandModal(initialValue: CustomCommand = { trigger: "", message: "", mode: "send" }) {
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
                    <TextArea value={code} onChange={setCode} placeholder="KCMD1:..." autosize />
                </section>
                {parsed && (
                    <Paragraph>Ready to import {parsed.length} command{parsed.length === 1 ? "" : "s"}. Any with the same trigger will be replaced.</Paragraph>
                )}
            </Flex>
        </Modal>
    );
}

function CommandDialog({ initialValue, modalProps }: { initialValue: CustomCommand; modalProps: RenderModalProps; }) {
    const [trigger, setTrigger] = useState(initialValue.trigger);
    const [message, setMessage] = useState(initialValue.message.replaceAll("\\n", "\n"));
    const [insertMode, setInsertMode] = useState(initialValue.mode === "insert");

    const isEdit = Boolean(initialValue.trigger);

    const prefix = settings.store.prefix.trim() || ".";
    const cleanTrigger = trigger.startsWith(prefix) ? trigger.slice(prefix.length) : trigger;

    const hasWhitespace = /\s/.test(cleanTrigger);
    const alreadyExists = cleanTrigger.toLowerCase() !== initialValue.trigger.toLowerCase() && getCommand(cleanTrigger);

    const notice = hasWhitespace
        ? "The trigger cannot contain spaces."
        : alreadyExists
            ? `A command "${prefix}${cleanTrigger}" already exists and will be overwritten.`
            : undefined;

    return (
        <Modal
            {...modalProps}
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
                        if (isEdit && initialValue.trigger.toLowerCase() !== cleanTrigger.toLowerCase()) {
                            removeCommand(initialValue.trigger);
                        }

                        addCommand({ trigger: cleanTrigger, message, mode: insertMode ? "insert" : "send" });
                        modalProps.onClose();
                    },
                    disabled: !cleanTrigger || !message || hasWhitespace
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
                    <HeadingSecondary>Message</HeadingSecondary>
                    <TextArea value={message} onChange={setMessage} placeholder={EXAMPLE_RESPONSE} autosize />
                </section>

                <FormSwitch
                    title="Put the message in the chat box instead of sending it"
                    description="Lets you review or edit the expanded text before you hit enter."
                    value={insertMode}
                    onChange={setInsertMode}
                    hideBorder
                />

                <ExpandableSection
                    renderContent={() => (
                        <Flex flexDirection="column" gap={12}>
                            <Paragraph>
                                Placeholders in your message get replaced when you send it: <InlineCode>{"{args}"}</InlineCode> is the text you type after the trigger, <InlineCode>{"{mentions}"}</InlineCode> turns every Discord ID after the trigger into a ping line, <InlineCode>{"{channel}"}</InlineCode> the current channel, <InlineCode>{"{date}"}</InlineCode> today's date and <InlineCode>{"{time}"}</InlineCode> the current time.
                            </Paragraph>
                            <Paragraph>
                                If your message has no <InlineCode>{"{args}"}</InlineCode> but you still type extra text, it gets added to the end.
                            </Paragraph>
                            <section>
                                <Paragraph><b>Example message:</b> <InlineCode>{EXAMPLE_RESPONSE}</InlineCode></Paragraph>
                                <Paragraph><b>Example usage:</b> <InlineCode>{`${prefix}${cleanTrigger || "termin"} morgen 14 Uhr`}</InlineCode></Paragraph>
                            </section>
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
