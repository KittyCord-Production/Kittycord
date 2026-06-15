/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_ICON } from "../../branding";
import { canvasToBlob, COL, drawDiamond, drawGlow, drawSparkle, FONT, loadImage, roundRectPath, wrapText } from "./canvasKit";

const WIDTH = 1200;
const HEIGHT = 630;

export const INVITE_FILENAME = "kittycord-invite.png";

async function loadAvatar(url: string): Promise<HTMLImageElement | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
            return await loadImage(objectUrl);
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        return null;
    }
}

function drawBackground(ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "#1b1018");
    bg.addColorStop(0.55, "#130b11");
    bg.addColorStop(1, "#0b0608");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawGlow(ctx, 90, 60, 420, "255, 95, 166", 0.22);
    drawGlow(ctx, WIDTH - 60, HEIGHT - 50, 480, "240, 80, 155", 0.18);

    drawDiamond(ctx, WIDTH - 80, 90, 130, "rgba(255, 95, 166, 0.08)");
    drawDiamond(ctx, 50, HEIGHT - 70, 110, "rgba(255, 138, 196, 0.05)");

    const sparkles: [number, number, number, number][] = [
        [180, 140, 8, 0.7], [1020, 180, 7, 0.55], [240, 500, 6, 0.5],
        [980, 470, 10, 0.6], [620, 90, 6, 0.4], [840, 560, 7, 0.5]
    ];
    for (const [x, y, s, a] of sparkles) drawSparkle(ctx, x, y, s, a);

    roundRectPath(ctx, 16, 16, WIDTH - 32, HEIGHT - 32, 44);
    ctx.strokeStyle = "rgba(255, 138, 196, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

export async function renderInviteCard(inviterName: string, avatarUrl: string | null): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);
    const avatar = avatarUrl ? await loadAvatar(avatarUrl) : null;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";
    drawBackground(ctx);

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

    const pillH = 72;
    const pillY = HEIGHT - 142;
    const label = "kittycord.dev";
    ctx.font = `700 34px ${FONT}`;
    const labelW = ctx.measureText(label).width;
    const catSize = 44;
    const pillW = catSize + 16 + labelW + 76;
    const pillX = cx - pillW / 2;

    const pillGrad = ctx.createLinearGradient(pillX, 0, pillX + pillW, 0);
    pillGrad.addColorStop(0, COL.pinkStrong);
    pillGrad.addColorStop(1, COL.pink);
    ctx.fillStyle = pillGrad;
    roundRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();

    const contentX = pillX + 38;
    ctx.save();
    roundRectPath(ctx, contentX, pillY + (pillH - catSize) / 2, catSize, catSize, 14);
    ctx.clip();
    ctx.drawImage(cat, contentX, pillY + (pillH - catSize) / 2, catSize, catSize);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = COL.white;
    ctx.font = `700 34px ${FONT}`;
    ctx.fillText(label, contentX + catSize + 16, pillY + pillH / 2 + 12);

    return canvasToBlob(canvas);
}
