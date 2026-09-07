/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_ICON } from "@branding";

import { canvasToBlob, COL, drawCardBackground, drawFooterPill, FONT, loadImage, loadImageCors, roundRectPath } from "./canvasKit";

const WIDTH = 1200;
const HEIGHT = 630;

export const INVITE_STATS_FILENAME = "kittycord-invites.png";

export async function renderInviteStatsCard(name: string, avatarUrl: string | null, invites: number, rank: number | null): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);
    const avatar = avatarUrl ? await loadImageCors(avatarUrl) : null;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";
    drawCardBackground(ctx, WIDTH, HEIGHT);

    const cx = WIDTH / 2;

    const avatarSize = 88;
    const avatarY = 74;
    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, cx - avatarSize / 2, avatarY, avatarSize, avatarSize);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cx, avatarY + avatarSize / 2, avatarSize / 2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = COL.pinkHi;
        ctx.lineWidth = 4;
        ctx.stroke();
    } else {
        ctx.save();
        roundRectPath(ctx, cx - avatarSize / 2, avatarY, avatarSize, avatarSize, 24);
        ctx.clip();
        ctx.drawImage(cat, cx - avatarSize / 2, avatarY, avatarSize, avatarSize);
        ctx.restore();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = COL.white;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText(name, cx, 222);

    ctx.fillStyle = COL.pinkHi;
    ctx.font = `800 148px ${FONT}`;
    ctx.fillText(String(invites), cx, 380);

    ctx.fillStyle = COL.white;
    ctx.font = `600 40px ${FONT}`;
    ctx.fillText(invites === 1 ? "friend invited to Kittycord" : "friends invited to Kittycord", cx, 438);

    if (rank != null) {
        ctx.fillStyle = COL.blush;
        ctx.font = `400 28px ${FONT}`;
        ctx.fillText(`Rank #${rank} on the all-time leaderboard`, cx, 484);
    }

    drawFooterPill(ctx, cx, HEIGHT - 132, "kittycord.dev", cat);

    return canvasToBlob(canvas);
}
