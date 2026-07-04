/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Themes that ship with Kittycord. On startup they are written into the user's themes folder so
// they show up in Settings > Themes for everyone.

import { createHash } from "crypto";
import amoledBlack from "file://themes/amoledBlack.theme.css";
import kittycordCandy from "file://themes/kittycordCandy.theme.css";
import lavender from "file://themes/lavender.theme.css";
import midnight from "file://themes/midnight.theme.css";
import midnightMagicGlass from "file://themes/MidnightMagicGlass.theme.css";
import modern from "file://themes/modern.theme.css";
import monoGlass from "file://themes/monoGlass.theme.css";
import sakura from "file://themes/sakura.theme.css";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

import { THEMES_DIR } from "./utils/constants";

const BUNDLED_THEMES: Record<string, string> = {
    "MonoGlass.theme.css": monoGlass,
    "Sakura.theme.css": sakura,
    "Midnight.theme.css": midnight,
    "MidnightMagicGlass.theme.css": midnightMagicGlass,
    "AMOLEDBlack.theme.css": amoledBlack,
    "Lavender.theme.css": lavender,
    "Modern.theme.css": modern,
    "KittycordCandy.theme.css": kittycordCandy
};

const SHIPPED_HASHES: Record<string, string[]> = {
    "MonoGlass.theme.css": [
        "3fb9544b134d6a7f2bdc424c0ab76e7746e7bf6f1106ce3cc3369dedd3c6aea5",
        "11e2d6f03d682b47e9a853fcb5f227b27a7dde0c047ce654f6b4c7c3f132d317"
    ],
    "Sakura.theme.css": [
        "d7c4d7ca7699c12ffa3b3a21a6febe47ac2503ee4de946374c72992290d42dcf",
        "723316cc6b7a19184ed44ddbd580a211cfe04fcc028cf732b6b27288da11e1fc"
    ],
    "Midnight.theme.css": [
        "89fc8d6b7bfdc984ec8016ec9d8b0b89873c141d336827cc60feba34777948cc",
        "61a494dbf31fd7ea8996498d444412b1afeaa56cde1b39a637756f50c372e0dd"
    ],
    "MidnightMagicGlass.theme.css": [
        "524c9013987a42164fb883bd5e5d4b1e4237b50ca0ca414a1c6ba6ed088a77c6",
        "efccceea50535d22df9bc239b36828fbf8751ad0cd2705e794176e964f2f06a1"
    ],
    "AMOLEDBlack.theme.css": [
        "9b015a271fa1b99aad630b3f0f90d68316a1097b287e14f9d28637837fc16904",
        "d5d8facd13174d121d64c078ff189201033b1aa6a3ad103c214427d89d030381"
    ],
    "Lavender.theme.css": [
        "9c93647dbb5f386ddc43699e48d928f909675830de918d5c4d3ac72dc84962c3",
        "715331af89bddde7221f70ffac7b859d0109abcce54c8d6064e5757caf8e26c5"
    ],
    "Modern.theme.css": ["9be93b7f9961f8cf649d01c5ff0dc9edf956248a6cb0dc7d51d3c22780203189"],
    "KittycordCandy.theme.css": [
        "935c8a108a429823507a0f4264fde093293b298eefbcca5c91d273e8872b3f29",
        "6e0152a4d0a418014fcc3d41ad47f82d953513985068232c6344d8096dfd77a3",
        "bd4fab3b6a588f7dcdb7b4f0f0b70058bec5109b1e9b2da2113b522471697ec1"
    ]
};

const MANIFEST_PATH = join(THEMES_DIR, ".kittycord-bundled.json");

const hashCss = (css: string) => createHash("sha256")
    .update((css.charCodeAt(0) === 0xFEFF ? css.slice(1) : css).replace(/\r\n/g, "\n").trimEnd(), "utf-8")
    .digest("hex");

try {
    mkdirSync(THEMES_DIR, { recursive: true });

    let manifest: Record<string, string> = {};
    try {
        manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
    } catch { }

    for (const [fileName, css] of Object.entries(BUNDLED_THEMES)) {
        const path = join(THEMES_DIR, fileName);
        const bundledHash = hashCss(css);

        if (!existsSync(path)) {
            writeFileSync(path, css, "utf-8");
            manifest[fileName] = bundledHash;
            continue;
        }

        const diskHash = hashCss(readFileSync(path, "utf-8"));
        if (diskHash === bundledHash) {
            manifest[fileName] = bundledHash;
            continue;
        }

        if (diskHash === manifest[fileName] || SHIPPED_HASHES[fileName]?.includes(diskHash)) {
            writeFileSync(path, css, "utf-8");
            manifest[fileName] = bundledHash;
        }
    }

    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4), "utf-8");
} catch (err) {
    console.error("[Kittycord] Failed to install bundled themes", err);
}
