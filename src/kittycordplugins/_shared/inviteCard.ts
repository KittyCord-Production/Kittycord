/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_ICON } from "@branding";

import { canvasToBlob, COL, drawCardBackground, drawFooterPill, FONT, loadImage, loadImageCors, roundRectPath, wrapText } from "./canvasKit";

const WIDTH = 1200;
const HEIGHT = 630;

export const INVITE_FILENAME = "kittycord-invite.png";

export async function renderInviteCard(inviterName: string, avatarUrl: string | null): Promise<Blob> {
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

    const avatarSize = 92;
    const avatarY = 78;
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
        roundRectPath(ctx, cx - avatarSize / 2, avatarY, avatarSize, avatarSize, 26);
        ctx.clip();
        ctx.drawImage(cat, cx - avatarSize / 2, avatarY, avatarSize, avatarSize);
        ctx.restore();
    }

    ctx.textAlign = "center";
    ctx.fillStyle = COL.white;
    ctx.font = `600 38px ${FONT}`;
    ctx.fillText(`${inviterName} invited you to`, cx, 236);

    ctx.fillStyle = COL.pinkHi;
    ctx.font = `800 104px ${FONT}`;
    ctx.fillText("Kittycord", cx, 342);

    ctx.fillStyle = COL.blush;
    ctx.font = `400 30px ${FONT}`;
    const tagline = "The cutest Discord mod — 350+ plugins, adorable themes and a one-click install.";
    const lines = wrapText(ctx, tagline, WIDTH - 320);
    let y = 398;
    for (const line of lines) {
        ctx.fillText(line, cx, y);
        y += 40;
    }

    drawFooterPill(ctx, cx, HEIGHT - 142, "kittycord.dev", cat);

    return canvasToBlob(canvas);
}
