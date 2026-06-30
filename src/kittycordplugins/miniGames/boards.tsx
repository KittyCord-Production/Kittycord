/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, React, Text, UserStore } from "@webpack/common";

import { RPS_CHOICES, RPS_NAMES, RpsState, rpsWinner, TttState } from "./engine";
import { sha256Hex } from "./protocol";

const ACCENT = "#ff5fa6";
const ACCENT_2 = "#8ad1ff";

export function name(id: string): string {
    if (id === UserStore.getCurrentUser()?.id) return "you";
    return UserStore.getUser(id)?.username ?? "them";
}

export function GameCard({ title, children }: { title: string; children: React.ReactNode; }) {
    return (
        <div style={{ display: "inline-block", padding: 12, margin: "4px 0", borderRadius: 8, border: "1px solid rgba(255, 95, 166, 0.25)", background: "var(--background-secondary)", minWidth: 220 }}>
            <Text variant="text-md/semibold" style={{ color: ACCENT, marginBottom: 8 }}>🎮 {title}</Text>
            {children}
        </div>
    );
}

interface TttProps {
    state: TttState;
    meId: string;
    onMove(cell: number): void;
    onRematch(): void;
}

export function TttBoard({ state, meId, onMove, onRematch }: TttProps) {
    const participant = meId === state.starter || meId === state.vs;
    const over = !!state.winner || state.draw || !state.valid;
    const myTurn = state.valid && state.nextPlayer === meId;

    let status: string;
    if (!state.valid) status = "This game got tangled — start a fresh one.";
    else if (state.winner) status = state.winner === meId ? "You win! 🎉" : `${name(state.winner)} wins!`;
    else if (state.draw) status = "It's a draw!";
    else if (myTurn) status = "Your turn";
    else status = `Waiting for ${name(state.nextPlayer ?? state.vs)}…`;

    return (
        <GameCard title="Tic-tac-toe">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 36px)", gap: 4, marginBottom: 8 }}>
                {state.board.map((cell, i) => (
                    <button
                        key={i}
                        onClick={() => onMove(i)}
                        disabled={!myTurn || cell !== null || over}
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 6,
                            border: "1px solid rgba(255, 95, 166, 0.55)",
                            background: "rgba(255, 95, 166, 0.08)",
                            color: cell === "X" ? ACCENT : ACCENT_2,
                            fontSize: 18,
                            fontWeight: 700,
                            cursor: myTurn && cell === null && !over ? "pointer" : "default"
                        }}
                    >
                        {cell ?? ""}
                    </button>
                ))}
            </div>
            <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>{status}</Text>
            {participant && over && (
                <Button size={Button.Sizes.SMALL} style={{ marginTop: 8 }} onClick={onRematch}>
                    Rematch
                </Button>
            )}
        </GameCard>
    );
}

interface RpsProps {
    state: RpsState;
    meId: string;
    pendingChoice: number | null;
    onCounter(choice: number): void;
    onReveal(): void;
    onRematch(): void;
}

export function RpsBoard({ state, meId, pendingChoice, onCounter, onReveal, onRematch }: RpsProps) {
    const [fair, setFair] = React.useState<boolean | null>(null);
    const participant = meId === state.starter || meId === state.vs;

    React.useEffect(() => {
        if (state.phase !== "done" || state.revealMove === undefined || !state.nonce) return;
        let cancelled = false;
        sha256Hex(`${state.revealMove}:${state.nonce}`).then(hash => {
            if (!cancelled) setFair(hash === state.commit);
        });
        return () => { cancelled = true; };
    }, [state.phase, state.revealMove, state.nonce, state.commit]);

    let body: React.ReactNode;
    if (!state.valid) {
        body = <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>This game got tangled — start a fresh one.</Text>;
    } else if (state.phase === "waitCounter") {
        body = meId === state.vs ? (
            <>
                <Text variant="text-sm/normal" style={{ opacity: 0.85, marginBottom: 6 }}>{name(state.starter)} sealed a move. Pick yours:</Text>
                <div style={{ display: "flex", gap: 6 }}>
                    {RPS_CHOICES.map((emoji, i) => (
                        <Button key={i} size={Button.Sizes.SMALL} onClick={() => onCounter(i)}>{emoji}</Button>
                    ))}
                </div>
            </>
        ) : (
            <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>
                {meId === state.starter && pendingChoice !== null
                    ? `You sealed ${RPS_CHOICES[pendingChoice]} — waiting for ${name(state.vs)} to pick…`
                    : `Waiting for ${name(state.vs)} to pick…`}
            </Text>
        );
    } else if (state.phase === "waitReveal") {
        body = meId === state.starter ? (
            pendingChoice !== null ? (
                <>
                    <Text variant="text-sm/normal" style={{ opacity: 0.85, marginBottom: 6 }}>{name(state.vs)} picked! Time to reveal.</Text>
                    <Button size={Button.Sizes.SMALL} onClick={onReveal}>Reveal my move</Button>
                </>
            ) : (
                <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>Your sealed move was lost on this device — call it a draw 😿</Text>
            )
        ) : (
            <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>Waiting for {name(state.starter)} to reveal…</Text>
        );
    } else {
        const starterMove = state.revealMove!;
        const vsMove = state.counterMove!;
        const result = rpsWinner(starterMove, vsMove);
        const winnerId = result === "draw" ? null : result === "starter" ? state.starter : state.vs;
        body = (
            <>
                <Text variant="text-md/normal" style={{ marginBottom: 4 }}>
                    {RPS_CHOICES[starterMove]} {name(state.starter)} vs {name(state.vs)} {RPS_CHOICES[vsMove]}
                </Text>
                {fair === false ? (
                    <Text variant="text-sm/normal" style={{ color: "var(--text-danger)" }}>
                        ⚠️ {name(state.starter)}'s reveal doesn't match the sealed move.
                    </Text>
                ) : (
                    <Text variant="text-sm/normal" style={{ opacity: 0.85 }}>
                        {winnerId === null
                            ? `Draw — ${RPS_NAMES[starterMove]} on both sides!`
                            : winnerId === meId ? "You win! 🎉" : `${name(winnerId)} wins!`}
                    </Text>
                )}
                {participant && (
                    <Button size={Button.Sizes.SMALL} style={{ marginTop: 8 }} onClick={onRematch}>
                        Rematch
                    </Button>
                )}
            </>
        );
    }

    return <GameCard title="Rock, paper, scissors">{body}</GameCard>;
}
