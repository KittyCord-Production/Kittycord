/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { DeleteIcon, LinkIcon, PencilIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { classNameFactory } from "@utils/css";
import { Select, TextInput, useMemo, useState } from "@webpack/common";

import { openCommandModal, openImportModal } from "./CommandModal";
import { openPackGallery, openPackPublish, packsAvailable } from "./PackGallery";
import { CustomCommand, removeCommand, settings } from "./settings";
import { openShareModal } from "./ShareModal";
import { forgetUse, useCount } from "./store";

const cl = classNameFactory("vc-commandStudio-");

const UNCATEGORISED = "Everything else";

function scopeLabel(command: CustomCommand) {
    const { scope } = command;
    if (!scope || scope.kind === "everywhere") return null;
    if (scope.kind === "dms") return "DMs only";
    return `${scope.guildIds.length} server${scope.guildIds.length === 1 ? "" : "s"}`;
}

function matches(command: CustomCommand, query: string) {
    if (!query) return true;
    const haystack = [command.trigger, command.description, command.category, ...(command.aliases ?? [])]
        .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes(query);
}

export function CommandList() {
    const { commands, prefix } = settings.use(["commands", "prefix"]);
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<"name" | "used">("name");

    const activePrefix = prefix.trim() || ".";
    const commandValues = Object.values(commands);
    const lowerQuery = query.trim().toLowerCase();

    const groups = useMemo(() => {
        const visible = commandValues.filter(c => matches(c, lowerQuery));

        const sorted = [...visible].sort((a, b) => sort === "used"
            ? useCount(b.trigger) - useCount(a.trigger) || a.trigger.localeCompare(b.trigger)
            : a.trigger.localeCompare(b.trigger));

        const byCategory = new Map<string, CustomCommand[]>();
        for (const command of sorted) {
            const key = command.category || UNCATEGORISED;
            const list = byCategory.get(key);
            if (list) list.push(command);
            else byCategory.set(key, [command]);
        }

        return [...byCategory.entries()].sort(([a], [b]) =>
            a === UNCATEGORISED ? 1 : b === UNCATEGORISED ? -1 : a.localeCompare(b));
    }, [commands, lowerQuery, sort]);

    function remove(command: CustomCommand) {
        removeCommand(command.trigger);
        forgetUse(command.trigger);
    }

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">Your Commands</BaseText>

            {commandValues.length > 3 && (
                <Flex gap="0.5em" className={Margins.top8}>
                    <TextInput value={query} onChange={setQuery} placeholder="Search your commands" />
                    <Select
                        options={[
                            { label: "A to Z", value: "name" },
                            { label: "Most used", value: "used" }
                        ]}
                        select={v => setSort(v)}
                        isSelected={v => sort === v}
                        serialize={String}
                    />
                </Flex>
            )}

            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {groups.map(([category, list]) => (
                    <div key={category}>
                        {groups.length > 1 && (
                            <Paragraph size="sm" weight="medium" className={cl("category")}>{category}</Paragraph>
                        )}
                        <Flex flexDirection="column" gap="0.5em">
                            {list.map(command => {
                                const used = useCount(command.trigger);
                                const scope = scopeLabel(command);

                                return (
                                    <Card key={command.trigger} className={cl("card")}>
                                        <div className={cl("info")}>
                                            <Paragraph size="md" weight="medium">
                                                {activePrefix}{command.trigger}
                                                {command.aliases?.length ? ` · ${command.aliases.map(a => activePrefix + a).join(" ")}` : ""}
                                            </Paragraph>
                                            <Paragraph size="sm" className={cl("preview")}>
                                                {command.description || command.message.replaceAll("\\n", "\n").split("\n")[0]}
                                            </Paragraph>
                                            {(used > 0 || scope) && (
                                                <Paragraph size="sm" className={cl("meta")}>
                                                    {[used ? `used ${used}×` : null, scope].filter(Boolean).join(" · ")}
                                                </Paragraph>
                                            )}
                                        </div>

                                        <Button
                                            variant="secondary"
                                            size="iconOnly"
                                            aria-label="Share Command"
                                            onClick={() => openShareModal([command], `${activePrefix}${command.trigger}`)}
                                        >
                                            <LinkIcon width={20} height={20} />
                                        </Button>
                                        <Button variant="secondary" size="iconOnly" onClick={() => openCommandModal(command)}>
                                            <PencilIcon aria-label="Edit Command" width={20} height={20} />
                                        </Button>
                                        <Button variant="dangerSecondary" size="iconOnly" onClick={() => remove(command)}>
                                            <DeleteIcon aria-label="Delete Command" width={20} height={20} />
                                        </Button>
                                    </Card>
                                );
                            })}
                        </Flex>
                    </div>
                ))}

                {commandValues.length > 0 && groups.length === 0 && (
                    <Paragraph size="sm">Nothing matches "{query}".</Paragraph>
                )}

                <Flex gap="0.5em">
                    <Button onClick={() => openCommandModal()}>Create Command</Button>
                    <Button variant="secondary" onClick={() => openImportModal()}>Import</Button>
                    {commandValues.length > 0 && (
                        <Button variant="secondary" onClick={() => openShareModal(commandValues, "all your commands")}>
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
