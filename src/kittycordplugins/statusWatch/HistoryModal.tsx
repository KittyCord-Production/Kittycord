/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { Button, moment, React, Text, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { clearHistory, getHistory, HistoryEntry } from "./history";
import { bucketColor, bucketLabel } from "./presence";

const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

function Row({ entry }: { entry: HistoryEntry; }) {
    const user = UserStore.getUser(entry.userId);

    return (
        <Flex style={{ padding: "8px 0", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="text-sm/semibold">{user?.globalName || user?.username || entry.userId}</Text>
                <Text variant="text-sm/normal" style={{ opacity: 0.75 }}>
                    <span style={{ color: bucketColor(entry.from) }}>{bucketLabel(entry.from)}</span>
                    {" → "}
                    <span style={{ color: bucketColor(entry.to) }}>{bucketLabel(entry.to)}</span>
                </Text>
            </div>
            <Text variant="text-xs/normal" style={{ opacity: 0.6, whiteSpace: "nowrap" }}>
                {moment(entry.at).calendar()}
            </Text>
        </Flex>
    );
}

function HistoryModal({ rootProps }: { rootProps: any; }) {
    const [list, setList] = React.useState<HistoryEntry[]>(getHistory());

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Flex style={{ alignItems: "center", width: "100%" }}>
                    <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Status Changes</Text>
                    <ModalCloseButton onClick={rootProps.onClose} />
                </Flex>
            </ModalHeader>
            <ModalContent>
                {list.length === 0
                    ? <Text variant="text-md/normal" style={{ padding: "16px 0" }}>Nothing here yet. Changes show up once someone you watch switches status.</Text>
                    : (
                        <>
                            {list.map(entry => <Row key={`${entry.userId}-${entry.at}`} entry={entry} />)}
                            <Flex style={{ justifyContent: "flex-end", margin: "16px 0" }}>
                                <Button
                                    size={Button.Sizes.SMALL}
                                    color={Button.Colors.RED}
                                    onClick={async () => {
                                        await clearHistory();
                                        setList([]);
                                    }}
                                >
                                    Clear history
                                </Button>
                            </Flex>
                        </>
                    )}
            </ModalContent>
        </ModalRoot>
    );
}

export function openHistoryModal() {
    openModal(props => <HistoryModal rootProps={props} />);
}
