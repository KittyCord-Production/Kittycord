/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { PencilIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { openModal } from "@utils/modal";
import { Avatar, IconUtils, UserStore } from "@webpack/common";

import { DisguiseModal } from "./DisguiseModal";
import { settings } from "./settings";

const cl = classNameFactory("vc-disguise-");

function avatarSrc(userId: string, templateId: string) {
    const user = UserStore.getUser(userId);
    return user ? IconUtils.getUserAvatarURL(user, false, 32) : IconUtils.getDefaultAvatarURL(templateId);
}

export function DisguiseList() {
    const { disguises } = settings.use(["disguises"]);
    const entries = Object.entries(disguises);

    if (entries.length === 0) {
        return (
            <Paragraph className={Margins.top8}>
                Right click someone and choose Disguise to hide who they are.
            </Paragraph>
        );
    }

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">Active disguises</BaseText>
            <Paragraph className={Margins.top8}>
                Only the cover identity is listed here, never the real one.
            </Paragraph>

            {entries.map(([userId, disguise]) => (
                <Card className={cl("row")} key={userId}>
                    <Avatar src={avatarSrc(userId, disguise.templateId)} size="SIZE_32" />
                    <div className={cl("row-text")}>
                        <BaseText size="sm" weight="semibold">{disguise.globalName || disguise.username}</BaseText>
                        <BaseText size="xs" color="text-muted">{userId}</BaseText>
                    </div>
                    <Button
                        variant="secondary"
                        onClick={() => openModal(modalProps => <DisguiseModal modalProps={modalProps} userId={userId} />)}
                    >
                        <PencilIcon />
                    </Button>
                </Card>
            ))}
        </section>
    );
}
