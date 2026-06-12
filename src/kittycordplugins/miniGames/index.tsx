/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { updateMessage } from "@api/MessageUpdater";
import { ErrorBoundary } from "@components/index";
import { sendMessage } from "@utils/discord";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import definePlugin from "@utils/types";
import type { Message, User } from "@vencord/discord-types";
import { Button, ChannelStore, Menu, MessageStore, React, SelectedChannelStore, showToast, Text, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { ensureDmChannel } from "../_shared/dm";
import { GameCard, RpsBoard, TttBoard } from "./boards";
import { collectGame, deriveGame, GameMessage, RPS_CHOICES } from "./engine";
import { decodeGameMessage, encodeGameMessage, GAME_LABELS, GamePayload, MOVE_FALLBACK, newGameId, randomNonce, sha256Hex, startFallback } from "./protocol";
import { getPending, removePending, storePending } from "./store";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

async function sendGameMessage(userId: string, payload: GamePayload, fallback: string): Promise<boolean> {
    const channelId = await ensureDmChannel(userId);
    if (!channelId) {
        showToast("Could not open a DM with that user.", Toasts.Type.FAILURE);
        return false;
    }
    sendMessage(channelId, { content: encodeGameMessage(payload, fallback) });
    return true;
}

async function startTtt(user: User) {
    const payload: GamePayload = { v: 1, t: "ttt", g: newGameId(), n: 0, vs: user.id };
    if (await sendGameMessage(user.id, payload, startFallback("ttt"))) {
        showToast(`Tic-tac-toe started — ${user.username} goes first.`, Toasts.Type.SUCCESS);
    }
}

async function startRps(user: User, choice: number) {
    const g = newGameId();
    const nonce = randomNonce();
    const c = await sha256Hex(`${choice}:${nonce}`);
    await storePending(g, choice, nonce);
    const payload: GamePayload = { v: 1, t: "rps", g, n: 0, vs: user.id, c };
    if (await sendGameMessage(user.id, payload, startFallback("rps"))) {
        showToast(`You sealed ${RPS_CHOICES[choice]} — waiting for ${user.username}.`, Toasts.Type.SUCCESS);
    } else {
        await removePending(g);
    }
}

function GamePickerModal({ rootProps, user }: { rootProps: any; user: User; }) {
    const [picking, setPicking] = React.useState(false);

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Play a game with {user.username}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
                    {!picking ? (
                        <>
                            <Button onClick={() => { rootProps.onClose(); startTtt(user); }}>
                                ⭕ {GAME_LABELS.ttt} — they go first
                            </Button>
                            <Button onClick={() => setPicking(true)}>
                                ✊ {GAME_LABELS.rps} — pick your move
                            </Button>
                        </>
                    ) : (
                        <>
                            <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>
                                Your move is sealed and only revealed after they pick — no cheating possible.
                            </Text>
                            <div style={{ display: "flex", gap: 8 }}>
                                {RPS_CHOICES.map((emoji, i) => (
                                    <Button key={i} onClick={() => { rootProps.onClose(); startRps(user, i); }}>
                                        {emoji}
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openGamePicker(user: User) {
    openModal(props => <GamePickerModal rootProps={props} user={user} />);
}

function GameAccessoryInner({ message }: { message: Message; }) {
    const [pendingChoice, setPendingChoice] = React.useState<number | null>(null);
    const sendingRef = React.useRef(false);
    const payload = decodeGameMessage(message.content);

    React.useEffect(() => {
        if (!payload) return;
        let cancelled = false;
        getPending(payload.g).then(p => {
            if (!cancelled && p) setPendingChoice(p.choice);
        });
        return () => { cancelled = true; };
    }, [payload?.g]);

    if (!payload) return null;
    const channel = ChannelStore.getChannel(message.channel_id);
    if (!channel?.isPrivate?.()) return null;
    const me = UserStore.getCurrentUser();
    if (!me) return null;

    const all: GameMessage[] = [];
    const cached = MessageStore.getMessages(message.channel_id)?.toArray?.() ?? [];
    for (const m of cached) {
        const p = decodeGameMessage(m.content);
        if (p && p.g === payload.g && m.author?.id) all.push({ id: m.id, authorId: m.author.id, payload: p });
    }
    if (!all.some(m => m.id === message.id) && message.author?.id) {
        all.push({ id: message.id, authorId: message.author.id, payload });
    }

    const sorted = collectGame(all, payload.g);
    if (sorted.length === 0 || sorted[sorted.length - 1].id !== message.id) return null;

    const state = deriveGame(sorted);
    if (!state) {
        return (
            <GameCard title={GAME_LABELS[payload.t]}>
                <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>Scroll up to load this game.</Text>
            </GameCard>
        );
    }

    function send(p: GamePayload) {
        if (sendingRef.current) return;
        sendingRef.current = true;
        sendMessage(message.channel_id, { content: encodeGameMessage(p, MOVE_FALLBACK) });
        setTimeout(() => { sendingRef.current = false; }, 1500);
    }

    function rematch() {
        const opponentId = state!.starter === me.id ? state!.vs : state!.starter;
        const opponent = UserStore.getUser(opponentId);
        if (opponent) openGamePicker(opponent);
    }

    if (state.kind === "ttt") {
        return (
            <TttBoard
                state={state}
                meId={me.id}
                onMove={cell => send({ v: 1, t: "ttt", g: payload.g, n: state.moveCount + 1, m: cell })}
                onRematch={rematch}
            />
        );
    }

    return (
        <RpsBoard
            state={state}
            meId={me.id}
            pendingChoice={pendingChoice}
            onCounter={choice => send({ v: 1, t: "rps", g: payload.g, n: 1, m: choice })}
            onReveal={async () => {
                const pending = await getPending(payload.g);
                if (!pending) return;
                send({ v: 1, t: "rps", g: payload.g, n: 2, m: pending.choice, x: pending.nonce });
                await removePending(payload.g);
            }}
            onRematch={rematch}
        />
    );
}

const GameAccessory = ErrorBoundary.wrap(GameAccessoryInner, { noop: true });

export default definePlugin({
    name: "MiniGames",
    description: "Play tic-tac-toe and rock-paper-scissors right inside your DMs with other Kittycord users — friends without Kittycord get a cute invite instead.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Fun"],
    enabledByDefault: true,
    dependencies: ["MessageAccessoriesAPI", "MessageUpdaterAPI", "ContextMenuAPI"],

    toolboxActions: {
        "Start a game"() {
            const channelId = SelectedChannelStore.getChannelId();
            const channel = channelId ? ChannelStore.getChannel(channelId) : null;
            const me = UserStore.getCurrentUser();
            const recipientId = channel?.isPrivate?.() ? channel.recipients?.find((id: string) => id !== me?.id) : null;
            const user = recipientId ? UserStore.getUser(recipientId) : null;
            if (user) openGamePicker(user);
            else showToast("Open a DM first, then start a game.", Toasts.Type.MESSAGE);
        }
    },

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            if (!user || user.bot || user.id === UserStore.getCurrentUser()?.id) return;
            children.push(
                <Menu.MenuItem
                    id="kc-minigames-play"
                    label="Play a game…"
                    action={() => openGamePicker(user)}
                />
            );
        }
    },

    renderMessageAccessory({ message }) {
        if (!decodeGameMessage((message as Message)?.content)) return null;
        return <GameAccessory message={message as Message} />;
    },

    flux: {
        MESSAGE_CREATE({ message, optimistic }: { message: any; optimistic: boolean; }) {
            if (optimistic || !message?.channel_id) return;
            const payload = decodeGameMessage(message.content);
            if (!payload) return;
            const cached = MessageStore.getMessages(message.channel_id)?.toArray?.() ?? [];
            for (const m of cached) {
                if (m.id === message.id) continue;
                const p = decodeGameMessage(m.content);
                if (p && p.g === payload.g) updateMessage(message.channel_id, m.id);
            }
        }
    }
});
