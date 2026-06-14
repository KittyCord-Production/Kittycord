/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Flex } from "@components/Flex";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin, { OptionType } from "@utils/types";
import { Button, React, SelectedChannelStore, showToast, Text, Toasts, UserStore } from "@webpack/common";

import { GhostController } from "./ghost";
import { GHOST_ACCESSORY_THUMBS } from "./ghostArt";
import { PetController } from "./pet";
import { ACCESSORIES, ACCESSORY_URIS } from "./sprites";
import { ACCESSORY_LEVELS, addXp, DAILY_MSG_XP_CAP, getSave, levelFor, loadSave, MAX_LEVEL, nextLevelXp, updateSave } from "./state";
import style from "./style.css?managed";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as React.ComponentType<any>;
const ModalHeader = ModalHeaderRaw as React.ComponentType<any>;
const ModalContent = ModalContentRaw as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as React.ComponentType<any>;

const settings = definePluginSettings({
    style: {
        type: OptionType.SELECT,
        description: "How your pet gets around",
        options: [
            { label: "Cat — walks along the bottom", value: "cat", default: true },
            { label: "Ghost — floats and follows your cursor", value: "ghost" }
        ],
        onChange: () => restartController()
    },
    size: {
        type: OptionType.SELECT,
        description: "How big your pet is",
        options: [
            { label: "Small", value: 24 },
            { label: "Medium", value: 32, default: true },
            { label: "Large", value: 48 }
        ]
    },
    speed: {
        type: OptionType.SLIDER,
        description: "How fast your pet moves around",
        markers: [0.5, 1, 1.5, 2, 3],
        default: 1,
        stickToMarkers: true
    },
    reactions: {
        type: OptionType.BOOLEAN,
        description: "React to pings, new messages and typing",
        default: true
    },
    sleepWhenIdle: {
        type: OptionType.BOOLEAN,
        description: "Fall asleep when nothing happens for a while (cat style)",
        default: true
    }
});

let controller: PetController | GhostController | null = null;

function onPet() {
    updateSave({ pets: getSave().pets + 1 });
    addXp(2).then(notifyLevel);
}

function buildController(): PetController | GhostController {
    const getConfig = () => ({
        size: settings.store.size,
        speed: settings.store.speed,
        reactions: settings.store.reactions,
        sleepWhenIdle: settings.store.sleepWhenIdle
    });
    return settings.store.style === "ghost"
        ? new GhostController({ getConfig, onPet })
        : new PetController({ getConfig, onPet });
}

function startController() {
    controller = buildController();
    controller.setEquipped(getSave().equipped);
    controller.start();
}

function restartController() {
    if (!controller) return;
    controller.stop();
    startController();
}

function notifyLevel(level: number | null) {
    if (level === null) return;
    const unlocked = Object.entries(ACCESSORY_LEVELS).find(([, l]) => l === level)?.[0];
    const note = unlocked ? ` You unlocked the ${ACCESSORIES[unlocked].label.toLowerCase()}!` : "";
    showToast(`Your kitty reached level ${level}!${note}`, Toasts.Type.SUCCESS);
}

function PetModal({ rootProps }: { rootProps: any; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const save = getSave();
    const level = levelFor(save.xp);
    const next = nextLevelXp(level);
    const progress = next === null ? 1 : Math.min(1, save.xp / next);
    const isGhost = settings.store.style === "ghost";
    const thumbs = isGhost ? GHOST_ACCESSORY_THUMBS : ACCESSORY_URIS;

    async function equip(id: string | null) {
        await updateSave({ equipped: id });
        controller?.setEquipped(id);
        forceUpdate();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Your KittyPet</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <Text variant="heading-md/semibold">Level {level}{level >= MAX_LEVEL ? " (max)" : ""}</Text>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--background-tertiary)", margin: "8px 0" }}>
                        <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, borderRadius: 999, background: "linear-gradient(90deg, #ff5fa6, #ff8ac4)" }} />
                    </div>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8 }}>
                        {next === null ? "Fully grown — what a good kitty." : `${save.xp} / ${next} XP — click your pet and chat to level up.`}
                    </Text>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8, marginTop: 4 }}>
                        Petted {save.pets} time{save.pets === 1 ? "" : "s"}.
                    </Text>

                    <Text variant="heading-md/semibold" style={{ marginTop: 16, marginBottom: 8 }}>Accessories</Text>
                    <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={save.equipped === null ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            onClick={() => equip(null)}
                        >
                            None
                        </Button>
                        {Object.entries(ACCESSORIES).map(([id, acc]) => {
                            const needed = ACCESSORY_LEVELS[id] ?? 1;
                            const locked = level < needed;
                            return (
                                <Button
                                    key={id}
                                    size={Button.Sizes.SMALL}
                                    color={save.equipped === id ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                                    disabled={locked}
                                    onClick={() => equip(id)}
                                >
                                    <Flex style={{ gap: 6, alignItems: "center" }}>
                                        <img src={thumbs[id]} style={{ height: 14, imageRendering: isGhost ? "auto" : "pixelated" }} alt="" />
                                        <span>{locked ? `${acc.label} (level ${needed})` : acc.label}</span>
                                    </Flex>
                                </Button>
                            );
                        })}
                    </Flex>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "KittyPet",
    description: "A tiny pet that lives in your Discord — pick a pixel cat that walks around the bottom, or a ghost that drifts around the screen on its own. It reacts to pings, can be petted, and levels up to unlock accessories.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Fun", "Customisation"],
    settings,

    toolboxActions: {
        "Open KittyPet"() {
            openModal(props => <PetModal rootProps={props} />);
        }
    },

    flux: {
        async MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic: boolean; }) {
            if (optimistic || !controller || !message?.author) return;
            const me = UserStore.getCurrentUser();
            if (!me) return;
            if (message.author.id === me.id) {
                const today = new Date().toDateString();
                const save = getSave();
                const spent = save.msgDay === today ? save.msgXp : 0;
                if (spent < DAILY_MSG_XP_CAP) {
                    await updateSave({ msgDay: today, msgXp: spent + 1 });
                    notifyLevel(await addXp(1));
                }
                return;
            }
            const mentionsMe = Array.isArray(message.mentions) && message.mentions.some((u: any) => (u?.id ?? u) === me.id);
            if (mentionsMe) controller.react("mention");
            else if (message.channel_id === SelectedChannelStore.getChannelId()) controller.react("message");
        },
        TYPING_START({ channelId, userId }: { channelId: string; userId: string; }) {
            if (!controller) return;
            const me = UserStore.getCurrentUser();
            if (!me || userId === me.id) return;
            if (channelId === SelectedChannelStore.getChannelId()) controller.react("typing");
        }
    },

    async start() {
        enableStyle(style);
        await loadSave();
        startController();
    },

    stop() {
        controller?.stop();
        controller = null;
        disableStyle(style);
    }
});
