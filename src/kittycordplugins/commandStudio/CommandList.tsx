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

import { openCommandModal } from "./CommandModal";
import { removeCommand, settings } from "./settings";

const cl = classNameFactory("vc-commandStudio-");

export function CommandList() {
    const { commands, prefix } = settings.use(["commands", "prefix"]);
    const activePrefix = prefix.trim() || ".";

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">Your Commands</BaseText>
            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {Object.values(commands).map(command => (
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
                <Button onClick={() => openCommandModal()}>Create Command</Button>
            </Flex>
        </section>
    );
}
