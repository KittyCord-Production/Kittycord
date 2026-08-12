/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { PetArt } from "./ghost";
import { eyesFor, GHOST_ACCESSORIES, GhostExpression } from "./ghostArt";

export type AnimalSpecies = "dog" | "pig" | "cow" | "bunny" | "fox" | "penguin";

const torso = (fur: string, dark: string, light: string) =>
    `<ellipse cx="16" cy="27.5" rx="8" ry="4.5" fill="${fur}" stroke="${dark}" stroke-width="1.2"/><ellipse cx="16" cy="28.4" rx="4.2" ry="3" fill="${light}"/>`;

const paws = (fur: string, dark: string) =>
    `<ellipse cx="7.6" cy="24.5" rx="2.6" ry="3.4" fill="${fur}" stroke="${dark}" stroke-width="1"/><ellipse cx="24.4" cy="24.5" rx="2.6" ry="3.4" fill="${fur}" stroke="${dark}" stroke-width="1"/>`;

const head = (fur: string, dark: string) =>
    `<circle cx="16" cy="14" r="10.5" fill="${fur}" stroke="${dark}" stroke-width="1.2"/>`;

const smile = (nose: string, cy: number) =>
    `<path d="M16 ${cy} Q16 ${cy + 1.5} 14.5 ${cy + 1.7}" fill="none" stroke="${nose}" stroke-width="0.7" stroke-linecap="round"/><path d="M16 ${cy} Q16 ${cy + 1.5} 17.5 ${cy + 1.7}" fill="none" stroke="${nose}" stroke-width="0.7" stroke-linecap="round"/>`;

const DOG_FUR = "#e3a55e";
const DOG_DARK = "#bb7f3d";
const DOG_LIGHT = "#f9ead2";
const DOG_NOSE = "#4a3324";

const DOG = torso(DOG_FUR, DOG_DARK, DOG_LIGHT) + paws(DOG_FUR, DOG_DARK) + head(DOG_FUR, DOG_DARK)
    + `<path d="M24.6 28.2 Q30.6 27.2 29.8 22.2" fill="none" stroke="${DOG_FUR}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<ellipse cx="4.9" cy="15.4" rx="3.2" ry="6.8" transform="rotate(-18 4.9 15.4)" fill="${DOG_DARK}"/>`
    + `<ellipse cx="27.1" cy="15.4" rx="3.2" ry="6.8" transform="rotate(18 27.1 15.4)" fill="${DOG_DARK}"/>`
    + `<ellipse cx="16" cy="19.1" rx="5" ry="3.7" fill="${DOG_LIGHT}"/><ellipse cx="16" cy="17.4" rx="1.8" ry="1.3" fill="${DOG_NOSE}"/>`
    + smile(DOG_NOSE, 18.5);

const PIG_FUR = "#f2a5bd";
const PIG_DARK = "#d67f9c";
const PIG_LIGHT = "#ffd6e3";
const PIG_SNOUT = "#e88fae";
const PIG_NOSE = "#b8617f";

const PIG = torso(PIG_FUR, PIG_DARK, PIG_LIGHT) + paws(PIG_FUR, PIG_DARK) + head(PIG_FUR, PIG_DARK)
    + `<path d="M24.8 27.4 q3.8 -0.6 3.4 -2.8 q-0.4 -2.2 -2.3 -1.3 q-1.6 0.9 -0.1 2.5" fill="none" stroke="${PIG_FUR}" stroke-width="1.5" stroke-linecap="round"/>`
    + `<path d="M5.6 11.6 L9.8 3.4 L13.8 9.2 Z" fill="${PIG_FUR}" stroke="${PIG_DARK}" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M26.4 11.6 L22.2 3.4 L18.2 9.2 Z" fill="${PIG_FUR}" stroke="${PIG_DARK}" stroke-width="1" stroke-linejoin="round"/>`
    + `<ellipse cx="16" cy="19.2" rx="4.8" ry="3.5" fill="${PIG_SNOUT}" stroke="${PIG_DARK}" stroke-width="0.8"/>`
    + `<ellipse cx="14.3" cy="19.2" rx="0.95" ry="1.35" fill="${PIG_NOSE}"/><ellipse cx="17.7" cy="19.2" rx="0.95" ry="1.35" fill="${PIG_NOSE}"/>`;

const COW_FUR = "#f6f3ed";
const COW_DARK = "#cbc4b8";
const COW_PATCH = "#3d3540";
const COW_MUZZLE = "#f3b6c2";
const COW_NOSE = "#c0798b";

const COW = "<ellipse cx=\"9.2\" cy=\"4.6\" rx=\"2.3\" ry=\"1.5\" transform=\"rotate(-28 9.2 4.6)\" fill=\"#ffe3ad\" stroke=\"#d9b978\" stroke-width=\"0.6\"/>"
    + "<ellipse cx=\"22.8\" cy=\"4.6\" rx=\"2.3\" ry=\"1.5\" transform=\"rotate(28 22.8 4.6)\" fill=\"#ffe3ad\" stroke=\"#d9b978\" stroke-width=\"0.6\"/>"
    + torso(COW_FUR, COW_DARK, COW_FUR) + `<ellipse cx="12" cy="27.4" rx="2.6" ry="2" fill="${COW_PATCH}"/>`
    + paws(COW_FUR, COW_DARK) + head(COW_FUR, COW_DARK)
    + `<ellipse cx="3.9" cy="11.8" rx="3.6" ry="2.3" transform="rotate(-20 3.9 11.8)" fill="${COW_FUR}" stroke="${COW_DARK}" stroke-width="1"/>`
    + `<ellipse cx="28.1" cy="11.8" rx="3.6" ry="2.3" transform="rotate(20 28.1 11.8)" fill="${COW_FUR}" stroke="${COW_DARK}" stroke-width="1"/>`
    + `<ellipse cx="20.6" cy="8.4" rx="4" ry="3" transform="rotate(-12 20.6 8.4)" fill="${COW_PATCH}"/>`
    + `<ellipse cx="16" cy="19.4" rx="5.2" ry="3.6" fill="${COW_MUZZLE}"/>`
    + `<ellipse cx="14" cy="18.9" rx="0.9" ry="1.1" fill="${COW_NOSE}"/><ellipse cx="18" cy="18.9" rx="0.9" ry="1.1" fill="${COW_NOSE}"/>`;

const BUNNY_FUR = "#f7eff4";
const BUNNY_DARK = "#d5c5d0";
const BUNNY_INNER = "#ffbcd6";
const BUNNY_NOSE = "#e8779f";

const BUNNY = `<g transform="rotate(-28 12 13)"><rect x="10.1" y="0.6" width="3.8" height="13" rx="1.9" fill="${BUNNY_FUR}" stroke="${BUNNY_DARK}" stroke-width="1"/><rect x="11.3" y="2.2" width="1.5" height="9.2" rx="0.75" fill="${BUNNY_INNER}"/></g>`
    + `<g transform="rotate(28 20 13)"><rect x="18.1" y="0.6" width="3.8" height="13" rx="1.9" fill="${BUNNY_FUR}" stroke="${BUNNY_DARK}" stroke-width="1"/><rect x="19.2" y="2.2" width="1.5" height="9.2" rx="0.75" fill="${BUNNY_INNER}"/></g>`
    + torso(BUNNY_FUR, BUNNY_DARK, "#fffafd") + paws(BUNNY_FUR, BUNNY_DARK)
    + `<circle cx="27" cy="26.4" r="2.5" fill="${BUNNY_FUR}" stroke="${BUNNY_DARK}" stroke-width="1"/>`
    + head(BUNNY_FUR, BUNNY_DARK)
    + `<ellipse cx="16" cy="19.2" rx="4.2" ry="2.9" fill="#fffafd"/><path d="M14.7 17.6 L17.3 17.6 L16 19.2 Z" fill="${BUNNY_NOSE}"/>`
    + smile(BUNNY_NOSE, 19.2)
    + "<circle cx=\"9.6\" cy=\"17.2\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.5\"/><circle cx=\"22.4\" cy=\"17.2\" r=\"1.5\" fill=\"#ff8ac4\" opacity=\"0.5\"/>";

const FOX_FUR = "#e8894a";
const FOX_DARK = "#c26a33";
const FOX_LIGHT = "#fdf1e6";
const FOX_TIP = "#3b2f38";
const FOX_NOSE = "#3a2230";

const FOX = `<path d="M6.8 12.6 L7.4 3.2 L14.4 8.6 Z" fill="${FOX_FUR}" stroke="${FOX_DARK}" stroke-width="1" stroke-linejoin="round"/><path d="M8.6 10.8 L9 6 L12.2 8.8 Z" fill="${FOX_TIP}"/>`
    + `<path d="M25.2 12.6 L24.6 3.2 L17.6 8.6 Z" fill="${FOX_FUR}" stroke="${FOX_DARK}" stroke-width="1" stroke-linejoin="round"/><path d="M23.4 10.8 L23 6 L19.8 8.8 Z" fill="${FOX_TIP}"/>`
    + torso(FOX_FUR, FOX_DARK, FOX_LIGHT) + paws(FOX_FUR, FOX_DARK) + head(FOX_FUR, FOX_DARK)
    + `<path d="M25 27.6 Q31.2 25.8 30.6 20.4 Q30.2 16.8 27.6 18.2 Q30 21.4 26.6 24.6 Q25.2 25.8 25 27.6 Z" fill="${FOX_FUR}" stroke="${FOX_DARK}" stroke-width="1" stroke-linejoin="round"/>`
    + `<path d="M27.6 18.2 Q30.2 16.8 30.6 20.4 Q28.6 18.4 27.6 18.2 Z" fill="${FOX_LIGHT}"/>`
    + `<path d="M16 9.6 Q22.2 13.4 20.4 20.4 Q16 23.4 11.6 20.4 Q9.8 13.4 16 9.6 Z" fill="${FOX_LIGHT}"/>`
    + `<ellipse cx="16" cy="18.4" rx="1.7" ry="1.2" fill="${FOX_NOSE}"/>` + smile(FOX_NOSE, 19.4);

const PENGUIN_BODY = "#41516e";
const PENGUIN_DARK = "#2b3750";
const PENGUIN_BELLY = "#f8f4ec";
const PENGUIN_BEAK = "#f5a63c";
const PENGUIN_BEAK_DARK = "#d3862c";

const PENGUIN = `<ellipse cx="12.2" cy="30.6" rx="3.4" ry="1.7" fill="${PENGUIN_BEAK}" stroke="${PENGUIN_BEAK_DARK}" stroke-width="0.6"/>`
    + `<ellipse cx="19.8" cy="30.6" rx="3.4" ry="1.7" fill="${PENGUIN_BEAK}" stroke="${PENGUIN_BEAK_DARK}" stroke-width="0.6"/>`
    + torso(PENGUIN_BODY, PENGUIN_DARK, PENGUIN_BELLY)
    + `<ellipse cx="6.8" cy="24.4" rx="2.4" ry="4.6" transform="rotate(20 6.8 24.4)" fill="${PENGUIN_BODY}" stroke="${PENGUIN_DARK}" stroke-width="1"/>`
    + `<ellipse cx="25.2" cy="24.4" rx="2.4" ry="4.6" transform="rotate(-20 25.2 24.4)" fill="${PENGUIN_BODY}" stroke="${PENGUIN_DARK}" stroke-width="1"/>`
    + head(PENGUIN_BODY, PENGUIN_DARK)
    + `<ellipse cx="16" cy="16.2" rx="7.8" ry="7.2" fill="${PENGUIN_BELLY}"/>`
    + `<path d="M13 18.4 L19 18.4 L16 22 Z" fill="${PENGUIN_BEAK}" stroke="${PENGUIN_BEAK_DARK}" stroke-width="0.6" stroke-linejoin="round"/>`;

const BODIES: Record<AnimalSpecies, string> = { dog: DOG, pig: PIG, cow: COW, bunny: BUNNY, fox: FOX, penguin: PENGUIN };

const uriCache = new Map<string, string>();

export function buildAnimalUri(species: AnimalSpecies, { expression, accessory }: { expression: GhostExpression; accessory: string | null; }): string {
    const key = `${species}|${expression}|${accessory ?? ""}`;
    const cached = uriCache.get(key);
    if (cached) return cached;
    const acc = accessory && GHOST_ACCESSORIES[accessory] ? GHOST_ACCESSORIES[accessory].svg : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${BODIES[species] + eyesFor(expression) + acc}</svg>`;
    const uri = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    uriCache.set(key, uri);
    return uri;
}

export const animalArt = (species: AnimalSpecies): PetArt => ({
    build: opts => buildAnimalUri(species, opts),
    accessories: GHOST_ACCESSORIES
});
