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

import { PetController } from "./pet";
import { ACCESSORIES, ACCESSORY_URIS } from "./sprites";
import { ACCESSORY_LEVELS, DAILY_MSG_XP_CAP, getSave, levelFor, loadSave, MAX_LEVEL, nextLevelXp, updateSave } from "./state";
import style from "./style.css?managed";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as React.ComponentType<any>;
const ModalHeader = ModalHeaderRaw as React.ComponentType<any>;
const ModalContent = ModalContentRaw as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as React.ComponentType<any>;

const settings = definePluginSettings({
    size: {
        type: OptionType.SELECT,
        description: "How big the cat is",
        options: [
            { label: "Small", value: 24 },
            { label: "Medium", value: 32, default: true },
            { label: "Large", value: 48 }
        ]
    },
    speed: {
        type: OptionType.SLIDER,
        description: "How fast the cat walks",
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
        description: "Fall asleep when nothing happens for a while",
        default: true
    }
});

let controller: PetController | null = null;

async function addXp(amount: number) {
    const before = levelFor(getSave().xp);
    const next = await updateSave({ xp: getSave().xp + amount });
    const after = levelFor(next.xp);
    if (after > before) {
        const unlocked = Object.entries(ACCESSORY_LEVELS).find(([, l]) => l === after)?.[0];
        const note = unlocked ? ` You unlocked the ${ACCESSORIES[unlocked].label.toLowerCase()}!` : "";
        showToast(`Your kitty reached level ${after}!${note}`, Toasts.Type.SUCCESS);
    }
}

function PetModal({ rootProps }: { rootProps: any; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const save = getSave();
    const level = levelFor(save.xp);
    const next = nextLevelXp(level);
    const progress = next === null ? 1 : Math.min(1, save.xp / next);

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
                        {next === null ? "Fully grown — what a good kitty." : `${save.xp} / ${next} XP — pet the cat and chat to level up.`}
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
                                        <img src={ACCESSORY_URIS[id]} style={{ height: 14, imageRendering: "pixelated" }} alt="" />
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
    description: "A tiny pixel cat that lives in your Discord — it walks around, naps, reacts to pings and can be petted. Level it up to unlock accessories.",
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
                    await addXp(1);
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
        const save = await loadSave();
        controller = new PetController({
            getConfig: () => ({
                size: settings.store.size,
                speed: settings.store.speed,
                reactions: settings.store.reactions,
                sleepWhenIdle: settings.store.sleepWhenIdle
            }),
            onPet() {
                updateSave({ pets: getSave().pets + 1 });
                addXp(2);
            }
        });
        controller.setEquipped(save.equipped);
        controller.start();
    },

    stop() {
        controller?.stop();
        controller = null;
        disableStyle(style);
    }
});
