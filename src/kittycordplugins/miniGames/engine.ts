/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { GamePayload, RpsCounter, RpsReveal, RpsStart, TttMove, TttStart } from "./protocol";

export interface GameMessage {
    id: string;
    authorId: string;
    payload: GamePayload;
}

export function cmpSnowflake(a: string, b: string): number {
    if (a.length !== b.length) return a.length - b.length;
    return a < b ? -1 : a > b ? 1 : 0;
}

export function collectGame(all: GameMessage[], gameId: string): GameMessage[] {
    return all
        .filter(m => m.payload.g === gameId)
        .sort((a, b) => cmpSnowflake(a.id, b.id));
}

const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

export type TttCell = "X" | "O" | null;

export interface TttState {
    kind: "ttt";
    valid: boolean;
    starter: string;
    vs: string;
    board: TttCell[];
    nextPlayer: string | null;
    winner: string | null;
    draw: boolean;
    latestId: string;
    moveCount: number;
}

export function deriveTtt(msgs: GameMessage[]): TttState | null {
    const startMsg = msgs.find(m => m.payload.n === 0 && m.payload.t === "ttt");
    if (!startMsg) return null;
    const start = startMsg.payload as TttStart;
    const starter = startMsg.authorId;
    const { vs } = start;

    const state: TttState = {
        kind: "ttt",
        valid: starter !== vs,
        starter,
        vs,
        board: Array(9).fill(null),
        nextPlayer: vs,
        winner: null,
        draw: false,
        latestId: msgs[msgs.length - 1].id,
        moveCount: 0
    };

    const moves = msgs.filter(m => m.payload.t === "ttt" && m.payload.n > 0);
    for (const msg of moves) {
        if (!state.valid || state.winner || state.draw) {
            state.valid = false;
            break;
        }
        const move = msg.payload as TttMove;
        const expectedN = state.moveCount + 1;
        const expectedAuthor = state.nextPlayer;
        const symbol: TttCell = expectedAuthor === vs ? "X" : "O";
        if (move.n !== expectedN || msg.authorId !== expectedAuthor || state.board[move.m] !== null) {
            state.valid = false;
            break;
        }
        state.board[move.m] = symbol;
        state.moveCount++;
        if (WIN_LINES.some(line => line.every(i => state.board[i] === symbol))) {
            state.winner = msg.authorId;
            state.nextPlayer = null;
        } else if (state.moveCount === 9) {
            state.draw = true;
            state.nextPlayer = null;
        } else {
            state.nextPlayer = msg.authorId === vs ? starter : vs;
        }
    }

    return state;
}

export interface RpsState {
    kind: "rps";
    valid: boolean;
    starter: string;
    vs: string;
    commit: string;
    phase: "waitCounter" | "waitReveal" | "done";
    counterMove?: number;
    revealMove?: number;
    nonce?: string;
    latestId: string;
}

export function deriveRps(msgs: GameMessage[]): RpsState | null {
    const startMsg = msgs.find(m => m.payload.n === 0 && m.payload.t === "rps");
    if (!startMsg) return null;
    const start = startMsg.payload as RpsStart;
    const starter = startMsg.authorId;
    const { vs } = start;

    const state: RpsState = {
        kind: "rps",
        valid: starter !== vs,
        starter,
        vs,
        commit: start.c,
        phase: "waitCounter",
        latestId: msgs[msgs.length - 1].id
    };

    for (const msg of msgs.filter(m => m.payload.t === "rps" && m.payload.n > 0)) {
        if (!state.valid) break;
        const { payload } = msg;
        if (payload.n === 1 && state.phase === "waitCounter" && msg.authorId === vs) {
            state.counterMove = (payload as RpsCounter).m;
            state.phase = "waitReveal";
        } else if (payload.n === 2 && state.phase === "waitReveal" && msg.authorId === starter) {
            state.revealMove = (payload as RpsReveal).m;
            state.nonce = (payload as RpsReveal).x;
            state.phase = "done";
        } else {
            state.valid = false;
        }
    }

    return state;
}

export type GameState = TttState | RpsState;

export function deriveGame(msgs: GameMessage[]): GameState | null {
    if (msgs.length === 0) return null;
    const type = msgs[0].payload.t;
    return type === "ttt" ? deriveTtt(msgs) : deriveRps(msgs);
}

export const RPS_CHOICES = ["✊", "✋", "✌️"] as const;
export const RPS_NAMES = ["rock", "paper", "scissors"] as const;

export function rpsWinner(starterMove: number, vsMove: number): "starter" | "vs" | "draw" {
    if (starterMove === vsMove) return "draw";
    return (starterMove - vsMove + 3) % 3 === 1 ? "starter" : "vs";
}
