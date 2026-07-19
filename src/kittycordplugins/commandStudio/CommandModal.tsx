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
import { Modal, openModal, TextArea, TextInput, useState } from "@webpack/common";

import { addCommand, CustomCommand, getCommand, removeCommand, settings } from "./settings";

const EXAMPLE_RESPONSE = "Hallo, wann hättest du Zeit? Vorschlag: {args}";

export function openCommandModal(initialValue: CustomCommand = { trigger: "", message: "", mode: "send" }) {
    openModal(modalProps => (
        <CommandDialog initialValue={initialValue} modalProps={modalProps} />
    ));
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
                                Placeholders in your message get replaced when you send it: <InlineCode>{"{args}"}</InlineCode> is the text you type after the trigger, <InlineCode>{"{channel}"}</InlineCode> the current channel, <InlineCode>{"{date}"}</InlineCode> today's date and <InlineCode>{"{time}"}</InlineCode> the current time.
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
