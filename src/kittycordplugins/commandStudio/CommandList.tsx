/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { DeleteIcon, PencilIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { copyWithToast } from "@utils/discord";

import { openCommandModal, openImportModal } from "./CommandModal";
import { openPackGallery, openPackPublish, packsAvailable } from "./PackGallery";
import { exportCommands, removeCommand, settings } from "./settings";

const cl = classNameFactory("vc-commandStudio-");

export function CommandList() {
    const { commands, prefix } = settings.use(["commands", "prefix"]);
    const activePrefix = prefix.trim() || ".";
    const commandValues = Object.values(commands);

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">Your Commands</BaseText>
            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {commandValues.map(command => (
                    <Card key={command.trigger} className={cl("card")}>
                        <div className={cl("info")}>
                            <Paragraph size="md" weight="medium">{activePrefix}{command.trigger}</Paragraph>
                            <Paragraph size="sm" className={cl("preview")}>{command.message.replaceAll("\\n", "\n").split("\n")[0]}</Paragraph>
                        </div>

                        <Button variant="secondary" size="iconOnly" onClick={() => openCommandModal(command)}>
                            <PencilIcon aria-label="Edit Command" width={20} height={20} />
                        </Button>
                        <Button variant="dangerSecondary" size="iconOnly" onClick={() => removeCommand(command.trigger)}>
                            <DeleteIcon aria-label="Delete Command" width={20} height={20} />
                        </Button>
                    </Card>
                ))}
                <Flex gap="0.5em">
                    <Button onClick={() => openCommandModal()}>Create Command</Button>
                    <Button variant="secondary" onClick={() => openImportModal()}>Import</Button>
                    {commandValues.length > 0 && (
                        <Button
                            variant="secondary"
                            onClick={() => copyWithToast(exportCommands(commandValues), "Command pack copied — share it with anyone.")}
                        >
                            Share all
                        </Button>
                    )}
                </Flex>
                {packsAvailable() && (
                    <Flex gap="0.5em">
                        <Button variant="secondary" onClick={openPackGallery}>Browse packs</Button>
                        {commandValues.length > 0 && (
                            <Button variant="secondary" onClick={() => openPackPublish(commandValues)}>Publish a pack</Button>
                        )}
                    </Flex>
                )}
            </Flex>
        </section>
    );
}
