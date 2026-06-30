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
import { Button, React, SelectedChannelStore, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";

import { GhostController } from "./ghost";
import { GHOST_ACCESSORIES, GHOST_ACCESSORY_LEVELS, GHOST_ACCESSORY_THUMBS } from "./ghostArt";
import { startHearts, stopHearts } from "./hearts";
import { PetController } from "./pet";
import { buildRaccoonUri, RACCOON_ACCESSORIES, RACCOON_ACCESSORY_LEVELS, RACCOON_ACCESSORY_THUMBS } from "./raccoonArt";
import { ACCESSORIES, ACCESSORY_URIS } from "./sprites";
import { addXp, DAILY_MSG_XP_CAP, DAILY_PET_XP, getSave, grantPlayXp, levelFor, loadSave, MAX_LEVEL, nextLevelXp, PetProfile, updateSave } from "./state";
import style from "./style.css?managed";
import { buildTeddyUri, TEDDY_ACCESSORIES, TEDDY_ACCESSORY_LEVELS, TEDDY_ACCESSORY_THUMBS } from "./teddyArt";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as React.ComponentType<any>;
const ModalHeader = ModalHeaderRaw as React.ComponentType<any>;
const ModalContent = ModalContentRaw as React.ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as React.ComponentType<any>;

const CAT_ACCESSORY_LEVELS: Record<string, number> = { bow: 2, scarf: 3, hat: 4, crown: 5, flower: 6, glasses: 7, bell: 8, wizardHat: 9, star: 10, bowtie: 3, topHat: 5, headphones: 7 };

const TINTS: Record<string, string> = {
    pink: "",
    blue: "hue-rotate(220deg) saturate(1.1)",
    purple: "hue-rotate(300deg) saturate(1.05)",
    mint: "hue-rotate(168deg) saturate(0.85) brightness(1.05)",
    peach: "hue-rotate(40deg) saturate(1.2) brightness(1.08)",
    lavender: "hue-rotate(260deg) saturate(0.9) brightness(1.05)",
    gold: "hue-rotate(78deg) saturate(1.2) brightness(1.05)"
};

const AURAS: Record<string, string> = {
    pink: "rgba(255, 95, 166, 0.45)",
    blue: "rgba(138, 209, 255, 0.5)",
    purple: "rgba(176, 123, 216, 0.5)",
    mint: "rgba(120, 220, 170, 0.45)",
    gold: "rgba(255, 214, 107, 0.5)",
    lavender: "rgba(200, 170, 240, 0.5)",
    none: "transparent"
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const PET_COPY: Record<PetProfile, { title: string; grown: string; play: string; namePlaceholder: string; who: string; }> = {
    cat: { title: "KittyPet", grown: "Fully grown — what a good kitty.", play: "🍪 Play", namePlaceholder: "Name your kitty…", who: "Your kitty" },
    ghost: { title: "KittyGhost", grown: "Fully grown — what a lovely little spirit.", play: "🎾 Play", namePlaceholder: "Name your ghost…", who: "Your ghost" },
    teddy: { title: "KittyTeddy", grown: "Fully grown — what a cuddly bear.", play: "🍯 Play", namePlaceholder: "Name your teddy…", who: "Your teddy" },
    raccoon: { title: "KittyRaccoon", grown: "Fully grown — what a cheeky little trash panda.", play: "🍇 Play", namePlaceholder: "Name your raccoon…", who: "Your raccoon" }
};

interface AccessorySet {
    registry: Record<string, { label: string; }>;
    levels: Record<string, number>;
    thumbs: Record<string, string>;
    pixel: boolean;
}

const ACCESSORY_SETS: Record<PetProfile, AccessorySet> = {
    cat: { registry: ACCESSORIES, levels: CAT_ACCESSORY_LEVELS, thumbs: ACCESSORY_URIS, pixel: true },
    ghost: { registry: GHOST_ACCESSORIES, levels: GHOST_ACCESSORY_LEVELS, thumbs: GHOST_ACCESSORY_THUMBS, pixel: false },
    teddy: { registry: TEDDY_ACCESSORIES, levels: TEDDY_ACCESSORY_LEVELS, thumbs: TEDDY_ACCESSORY_THUMBS, pixel: false },
    raccoon: { registry: RACCOON_ACCESSORIES, levels: RACCOON_ACCESSORY_LEVELS, thumbs: RACCOON_ACCESSORY_THUMBS, pixel: false }
};

const settings = definePluginSettings({
    style: {
        type: OptionType.SELECT,
        description: "Which pet you want",
        options: [
            { label: "Cat — walks along the bottom", value: "cat", default: true },
            { label: "Ghost — drifts around the screen", value: "ghost" },
            { label: "Teddy — drifts around the screen", value: "teddy" },
            { label: "Raccoon — drifts around the screen", value: "raccoon" }
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
        description: "Fall asleep when nothing happens for a while",
        default: true
    },
    nametag: {
        type: OptionType.BOOLEAN,
        description: "Show a name tag above your pet (set the name in the pet menu)",
        default: false,
        onChange: () => restartController()
    }
});

let controller: PetController | GhostController | null = null;

const currentProfile = (): PetProfile => {
    const s = settings.store.style;
    return s === "ghost" || s === "teddy" || s === "raccoon" ? s : "cat";
};

function onPet() {
    const profile = currentProfile();
    const today = new Date().toDateString();
    const save = getSave(profile);
    const firstToday = save.lastPetDay !== today;
    if (firstToday) {
        const yesterday = new Date(Date.now() - 864e5).toDateString();
        const streak = save.lastPetDay === yesterday ? save.streak + 1 : 1;
        updateSave(profile, { pets: save.pets + 1, lastPetDay: today, streak }).then(() => controller?.setLastPetDay(today));
        showToast(`Daily pet! 🐱 ${streak} day streak.`, Toasts.Type.SUCCESS);
    } else {
        updateSave(profile, { pets: save.pets + 1 });
    }
    addXp(profile, firstToday ? DAILY_PET_XP : 2).then(notifyLevel);
}

function onPlay() {
    if (!controller) return;
    controller.lure(controller.getDropPoint());
    grantPlayXp(currentProfile()).then(notifyLevel);
}

function buildController(): PetController | GhostController {
    const getConfig = () => ({
        size: settings.store.size,
        speed: settings.store.speed,
        reactions: settings.store.reactions,
        sleepWhenIdle: settings.store.sleepWhenIdle
    });
    if (settings.store.style === "ghost") return new GhostController({ getConfig, onPet });
    if (settings.store.style === "teddy") return new GhostController({ getConfig, onPet }, { build: buildTeddyUri, accessories: TEDDY_ACCESSORIES });
    if (settings.store.style === "raccoon") return new GhostController({ getConfig, onPet }, { build: buildRaccoonUri, accessories: RACCOON_ACCESSORIES });
    return new PetController({ getConfig, onPet });
}

function startController() {
    controller = buildController();
    const save = getSave(currentProfile());
    controller.setEquipped(save.equipped);
    controller.setName(settings.store.nametag ? save.name : "");
    controller.setTint(TINTS[save.tint] ?? "");
    controller.setAura(AURAS[save.aura] ?? AURAS.pink);
    controller.setLastPetDay(save.lastPetDay);
    controller.start();
}

function restartController() {
    if (!controller) return;
    controller.stop();
    startController();
}

function notifyLevel(level: number | null) {
    if (level === null) return;
    controller?.celebrate(level);
    const profile = currentProfile();
    const set = ACCESSORY_SETS[profile];
    const unlocked = Object.entries(set.levels)
        .filter(([, l]) => l === level)
        .map(([id]) => set.registry[id].label.toLowerCase());
    const who = getSave(profile).name || PET_COPY[profile].who;
    const note = unlocked.length ? ` ${who} unlocked the ${unlocked.join(" and ")}!` : "";
    showToast(`🎉 Level ${level}!${note}`, Toasts.Type.SUCCESS);
}

function PetModal({ rootProps }: { rootProps: any; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const profile = currentProfile();
    const copy = PET_COPY[profile];
    const set = ACCESSORY_SETS[profile];
    const save = getSave(profile);
    const level = levelFor(save.xp);
    const next = nextLevelXp(level);
    const progress = next === null ? 1 : Math.min(1, save.xp / next);
    const [name, setName] = React.useState(save.name);

    async function equip(id: string | null) {
        await updateSave(profile, { equipped: id });
        controller?.setEquipped(id);
        forceUpdate();
    }

    function renameTo(value: string) {
        setName(value);
        updateSave(profile, { name: value });
        controller?.setName(settings.store.nametag ? value : "");
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Your {copy.title}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0" }}>
                    <Text variant="heading-md/semibold">Level {level}{level >= MAX_LEVEL ? " (max)" : ""}</Text>
                    <div style={{ height: 8, borderRadius: 999, background: "var(--background-tertiary)", margin: "8px 0" }}>
                        <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, borderRadius: 999, background: "linear-gradient(90deg, #ff5fa6, #ff8ac4)" }} />
                    </div>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8 }}>
                        {next === null
                            ? copy.grown
                            : `${save.xp} / ${next} XP — click your pet and chat to level up.`}
                    </Text>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8, marginTop: 4 }}>
                        Petted {save.pets} time{save.pets === 1 ? "" : "s"}.
                    </Text>
                    <Text variant="text-sm/normal" style={{ opacity: 0.8, marginTop: 4 }}>
                        {save.lastPetDay === new Date().toDateString()
                            ? `Petted today ✓ — ${save.streak} day streak.`
                            : "Pet me today for a bonus! 🐾"}
                    </Text>

                    <Flex style={{ gap: 8, marginTop: 12 }}>
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => onPlay()}>
                            {copy.play}
                        </Button>
                    </Flex>

                    <Text variant="heading-md/semibold" style={{ marginTop: 16, marginBottom: 8 }}>Accessories</Text>
                    <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                        <Button
                            size={Button.Sizes.SMALL}
                            color={save.equipped === null ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            onClick={() => equip(null)}
                        >
                            None
                        </Button>
                        {Object.entries(set.registry).map(([id, acc]) => {
                            const needed = set.levels[id] ?? 1;
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
                                        <img src={set.thumbs[id]} style={{ height: 14, imageRendering: set.pixel ? "pixelated" : "auto" }} alt="" />
                                        <span>{locked ? `${acc.label} (level ${needed})` : acc.label}</span>
                                    </Flex>
                                </Button>
                            );
                        })}
                    </Flex>

                    <Text variant="heading-md/semibold" style={{ marginTop: 16, marginBottom: 8 }}>Name</Text>
                    <TextInput
                        value={name}
                        placeholder={copy.namePlaceholder}
                        maxLength={20}
                        onChange={renameTo}
                    />
                    {!settings.store.nametag && (
                        <Text variant="text-sm/normal" style={{ opacity: 0.6, marginTop: 4 }}>
                            Turn on the name tag in this plugin's settings to show it above your pet.
                        </Text>
                    )}

                    <Text variant="heading-md/semibold" style={{ marginTop: 16, marginBottom: 8 }}>Colour</Text>
                    <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                        {Object.keys(TINTS).map(id => (
                            <Button
                                key={id}
                                size={Button.Sizes.SMALL}
                                color={save.tint === id ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                                onClick={async () => { await updateSave(profile, { tint: id }); controller?.setTint(TINTS[id]); forceUpdate(); }}
                            >
                                {cap(id)}
                            </Button>
                        ))}
                    </Flex>

                    <Text variant="heading-md/semibold" style={{ marginTop: 16, marginBottom: 8 }}>Aura</Text>
                    <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                        {Object.keys(AURAS).map(id => (
                            <Button
                                key={id}
                                size={Button.Sizes.SMALL}
                                color={save.aura === id ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                                onClick={async () => { await updateSave(profile, { aura: id }); controller?.setAura(AURAS[id]); forceUpdate(); }}
                            >
                                {cap(id)}
                            </Button>
                        ))}
                    </Flex>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "KittyPet",
    description: "A tiny pet that lives in your Discord — pick a pixel cat that walks around the bottom, or a ghost, teddy bear or raccoon that drifts around the screen on its own. It reacts to pings, can be petted, and levels up to unlock accessories. Each pet keeps its own level and accessories.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Fun", "Customisation"],
    settings,

    toolboxActions: {
        "Open KittyPet"() {
            openModal(props => <PetModal rootProps={props} />);
        },
        "Play with KittyPet"() {
            onPlay();
        }
    },

    flux: {
        async MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic: boolean; }) {
            if (optimistic || !controller || !message?.author) return;
            const me = UserStore.getCurrentUser();
            if (!me) return;
            if (message.author.id === me.id) {
                const profile = currentProfile();
                const today = new Date().toDateString();
                const save = getSave(profile);
                const spent = save.msgDay === today ? save.msgXp : 0;
                if (spent < DAILY_MSG_XP_CAP) {
                    await updateSave(profile, { msgDay: today, msgXp: spent + 1 });
                    notifyLevel(await addXp(profile, 1));
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
        },
        MESSAGE_REACTION_ADD({ optimistic, channelId, userId }: { optimistic?: boolean; channelId?: string; userId?: string; }) {
            if (optimistic || !controller) return;
            const me = UserStore.getCurrentUser();
            if (!me || userId === me.id) return;
            if (channelId === SelectedChannelStore.getChannelId()) controller.react("reaction");
        },
        STREAM_CREATE(e: string | { streamKey?: string; }) {
            if (!controller) return;
            const key = typeof e === "string" ? e : e?.streamKey;
            if (!key) return;
            const me = UserStore.getCurrentUser();
            if (me && key.endsWith(me.id)) controller.react("stream");
        }
    },

    async start() {
        enableStyle(style);
        startHearts();
        await loadSave("cat");
        await loadSave("ghost");
        await loadSave("teddy");
        await loadSave("raccoon");
        startController();
    },

    stop() {
        controller?.stop();
        controller = null;
        stopHearts();
        disableStyle(style);
    }
});
