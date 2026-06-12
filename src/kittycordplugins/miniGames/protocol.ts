/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type GameType = "ttt" | "rps";

const MARKER = "⁣‍⁣";
const ZERO = "​";
const ONE = "‌";

const SNOWFLAKE_RE = /^\d{17,20}$/;
const GAME_ID_RE = /^[a-z0-9]{6,12}$/;
const HEX_RE = /^[0-9a-f]{8,64}$/;

export interface TttStart { v: 1; t: "ttt"; g: string; n: 0; vs: string; }
export interface TttMove { v: 1; t: "ttt"; g: string; n: number; m: number; }
export interface RpsStart { v: 1; t: "rps"; g: string; n: 0; vs: string; c: string; }
export interface RpsCounter { v: 1; t: "rps"; g: string; n: 1; m: number; }
export interface RpsReveal { v: 1; t: "rps"; g: string; n: 2; m: number; x: string; }

export type GamePayload = TttStart | TttMove | RpsStart | RpsCounter | RpsReveal;

export function newGameId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function zwEncode(text: string): string {
    const bytes = new TextEncoder().encode(text);
    let out = "";
    for (const byte of bytes) {
        for (let bit = 7; bit >= 0; bit--) {
            out += (byte >> bit) & 1 ? ONE : ZERO;
        }
    }
    return out;
}

function zwDecode(zw: string): string | null {
    let bits = "";
    for (const ch of zw) {
        if (ch === ZERO) bits += "0";
        else if (ch === ONE) bits += "1";
    }
    if (bits.length === 0 || bits.length % 8 !== 0) return null;
    const bytes = new Uint8Array(bits.length / 8);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
    }
    try {
        return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        return null;
    }
}

function isValidPayload(raw: any): raw is GamePayload {
    if (!raw || typeof raw !== "object" || raw.v !== 1) return false;
    if (typeof raw.g !== "string" || !GAME_ID_RE.test(raw.g)) return false;
    if (!Number.isInteger(raw.n) || raw.n < 0 || raw.n > 100) return false;
    if (raw.t === "ttt") {
        if (raw.n === 0) return typeof raw.vs === "string" && SNOWFLAKE_RE.test(raw.vs);
        return Number.isInteger(raw.m) && raw.m >= 0 && raw.m <= 8;
    }
    if (raw.t === "rps") {
        if (raw.n === 0) return typeof raw.vs === "string" && SNOWFLAKE_RE.test(raw.vs) && typeof raw.c === "string" && HEX_RE.test(raw.c);
        if (raw.n === 1) return Number.isInteger(raw.m) && raw.m >= 0 && raw.m <= 2;
        if (raw.n === 2) return Number.isInteger(raw.m) && raw.m >= 0 && raw.m <= 2 && typeof raw.x === "string" && HEX_RE.test(raw.x);
    }
    return false;
}

export function encodeGameMessage(payload: GamePayload, fallback: string): string {
    return fallback + MARKER + zwEncode(JSON.stringify(payload));
}

export function decodeGameMessage(content: string | undefined): GamePayload | null {
    if (!content) return null;
    const idx = content.indexOf(MARKER);
    if (idx < 0) return null;
    const json = zwDecode(content.slice(idx + MARKER.length));
    if (!json) return null;
    try {
        const raw = JSON.parse(json);
        return isValidPayload(raw) ? raw : null;
    } catch {
        return null;
    }
}

export const GAME_LABELS: Record<GameType, string> = {
    ttt: "Tic-tac-toe",
    rps: "Rock, paper, scissors"
};

export function startFallback(type: GameType): string {
    return `🎮 ${GAME_LABELS[type]} — play with me! I'm using Kittycord → https://kittycord.dev`;
}

export const MOVE_FALLBACK = "🎮";

export async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export function randomNonce(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, "0")).join("");
}
