/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { PresenceStore, UserStore, useStateFromStores } from "@webpack/common";

import { openHistoryModal } from "./HistoryModal";
import { bucketColor, bucketLabel, BUCKETS, currentBucket } from "./presence";
import { setEvent, settings, toggleWatch, WatchEntry } from "./settings";

const cl = classNameFactory("vc-statusWatch-");

function WatchRow({ userId, events }: { userId: string; events: WatchEntry; }) {
    const user = UserStore.getUser(userId);
    const bucket = useStateFromStores([PresenceStore], () => currentBucket(userId), [userId]);

    return (
        <Card className={cl("card")}>
            <div className={cl("who")}>
                {user && <img className={cl("avatar")} src={user.getAvatarURL(undefined, 40, false)} alt="" />}
                <div className={cl("info")}>
                    <Paragraph size="md" weight="medium">{user?.globalName || user?.username || userId}</Paragraph>
                    <Paragraph size="sm" className={cl("status")}>
                        <span className={cl("dot")} style={{ background: bucket ? bucketColor(bucket) : "var(--text-status-offline)" }} />
                        {bucket ? bucketLabel(bucket) : "No status yet"}
                    </Paragraph>
                </div>
                <Button variant="dangerSecondary" size="iconOnly" onClick={() => toggleWatch(userId)}>
                    <DeleteIcon aria-label="Stop watching" width={20} height={20} />
                </Button>
            </div>

            <Flex gap="0.25em" className={cl("events")}>
                {BUCKETS.map(b => (
                    <Button
                        key={b.key}
                        size="xs"
                        variant={events[b.key] ? "primary" : "secondary"}
                        onClick={() => setEvent(userId, b.key, !events[b.key])}
                    >
                        {b.label}
                    </Button>
                ))}
            </Flex>
        </Card>
    );
}

export function WatchList() {
    const { watched } = settings.use(["watched"]);
    const userIds = Object.keys(watched);

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">People You Watch</BaseText>

            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {userIds.length === 0
                    ? <Paragraph className={cl("empty")}>Nobody yet. Right click someone and pick "Watch their status".</Paragraph>
                    : userIds.map(id => <WatchRow key={id} userId={id} events={watched[id]} />)}

                <Flex gap="0.5em">
                    <Button variant="secondary" onClick={openHistoryModal}>Recent changes</Button>
                </Flex>
            </Flex>
        </section>
    );
}
