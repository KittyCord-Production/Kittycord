/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_ICON } from "../../branding";
import { canvasToBlob, COL, drawDiamond, drawGlow, drawSparkle, FONT, loadImage, roundRectPath, truncate, wrapText } from "../_shared/canvasKit";
import type { WrappedSnapshot } from "./storage";

export type WrappedVariant = "year" | "summer";

export interface Skin {
    title: string;
    subtitle: string;
    subtitleShare: string;
    bg: [string, string, string];
    glowRgb: string;
    glowSoftRgb: string;
    accent: string;
    accentStrong: string;
    accentHi: string;
    blush: string;
    faint: string;
}

export const SKINS: Record<WrappedVariant, Skin> = {
    year: {
        title: "Wrapped",
        subtitle: "your year on Discord, the cozy way",
        subtitleShare: "my year on Discord",
        bg: ["#1b1018", "#130b11", "#0b0608"],
        glowRgb: "255, 95, 166",
        glowSoftRgb: "255, 138, 196",
        accent: COL.pink,
        accentStrong: COL.pinkStrong,
        accentHi: COL.pinkHi,
        blush: COL.blush,
        faint: COL.faint
    },
    summer: {
        title: "Summer",
        subtitle: "your Kittycord summer so far",
        subtitleShare: "my summer on Discord",
        bg: ["#241611", "#1a110d", "#0d0806"],
        glowRgb: "255, 138, 92",
        glowSoftRgb: "255, 190, 110",
        accent: "#ff8a5c",
        accentStrong: "#ff6b4a",
        accentHi: "#ffd36b",
        blush: "#f0c3a0",
        faint: "#b58a6a"
    }
};

const WIDTH = 1080;
const HEIGHT = 1500;
const PAD = 72;
const CONTENT = WIDTH - PAD * 2;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function drawBackground(ctx: CanvasRenderingContext2D, skin: Skin) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, skin.bg[0]);
    bg.addColorStop(0.5, skin.bg[1]);
    bg.addColorStop(1, skin.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawGlow(ctx, 120, 80, 540, skin.glowRgb, 0.22);
    drawGlow(ctx, WIDTH - 60, HEIGHT - 120, 660, skin.glowRgb, 0.18);
    drawGlow(ctx, WIDTH - 120, 380, 380, skin.glowSoftRgb, 0.1);

    drawDiamond(ctx, WIDTH - 70, 150, 150, `rgba(${skin.glowRgb}, 0.08)`);
    drawDiamond(ctx, 40, HEIGHT - 380, 200, `rgba(${skin.glowSoftRgb}, 0.05)`);

    const sparkles: [number, number, number, number][] = [
        [180, 250, 9, 0.8], [880, 320, 7, 0.55], [240, 760, 6, 0.5],
        [930, 840, 11, 0.6], [120, 1040, 7, 0.45], [965, 1180, 8, 0.5],
        [620, 200, 6, 0.4], [820, 1300, 9, 0.55]
    ];
    for (const [x, y, s, a] of sparkles) drawSparkle(ctx, x, y, s, a);

    roundRectPath(ctx, 20, 20, WIDTH - 40, HEIGHT - 40, 56);
    ctx.strokeStyle = `rgba(${skin.glowSoftRgb}, 0.18)`;
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, cat: HTMLImageElement, skin: Skin) {
    const size = 64;
    const y = 72;
    ctx.save();
    roundRectPath(ctx, PAD, y, size, size, 18);
    ctx.clip();
    ctx.drawImage(cat, PAD, y, size, size);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = COL.white;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText("Kittycord", PAD + size + 20, y + 30);
    ctx.fillStyle = skin.accentHi;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(` ${skin.title}`, PAD + size + 20 + ctx.measureText("Kittycord").width, y + 30);

    ctx.fillStyle = skin.faint;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(skin.subtitle, PAD + size + 20, y + 58);
}

function drawVibe(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, skin: Skin, top: number): number {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    ctx.font = `400 128px ${FONT}`;
    ctx.fillText(snap.vibe.emoji, cx, top + 116);

    ctx.fillStyle = skin.faint;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText("YOUR VIBE", cx, top + 166);

    ctx.fillStyle = COL.white;
    ctx.font = `800 86px ${FONT}`;
    ctx.fillText(snap.vibe.label, cx, top + 248);

    ctx.fillStyle = skin.blush;
    ctx.font = `400 32px ${FONT}`;
    const lines = wrapText(ctx, snap.vibe.line, CONTENT - 60);
    let y = top + 298;
    for (const line of lines) {
        ctx.fillText(line, cx, y);
        y += 42;
    }
    return y + 4;
}

function drawBigNumber(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, skin: Skin, top: number): number {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = skin.accentHi;
    ctx.font = `800 148px ${FONT}`;
    ctx.fillText(snap.messages.toLocaleString(), cx, top + 120);

    ctx.fillStyle = COL.white;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText("messages sent", cx, top + 166);

    const since = new Date(snap.startedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    ctx.fillStyle = skin.faint;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText(`measuring since ${since}`, cx, top + 202);

    return top + 230;
}

function drawTopServers(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, skin: Skin, top: number): number {
    ctx.textAlign = "left";
    ctx.fillStyle = skin.faint;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText("TOP SERVERS", PAD, top);

    const y = top + 30;
    if (!snap.top.length) {
        ctx.fillStyle = skin.blush;
        ctx.font = `400 28px ${FONT}`;
        ctx.fillText("Send a few messages and your busiest servers show up here.", PAD, y + 34);
        return y + 64;
    }

    const max = Math.max(...snap.top.map(t => t.count), 1);
    const badge = 60;
    const rowH = 78;
    const barX = PAD + badge + 24;
    const countW = 96;
    const barW = CONTENT - badge - 24 - countW;

    for (let i = 0; i < snap.top.length; i++) {
        const t = snap.top[i];
        const rowY = y + i * rowH;

        const grad = ctx.createLinearGradient(PAD, rowY, PAD + badge, rowY + badge);
        grad.addColorStop(0, skin.accent);
        grad.addColorStop(1, skin.accentStrong);
        ctx.fillStyle = grad;
        roundRectPath(ctx, PAD, rowY, badge, badge, 16);
        ctx.fill();

        ctx.fillStyle = COL.white;
        ctx.font = `700 26px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(t.initials, PAD + badge / 2, rowY + badge / 2 + 9);

        ctx.textAlign = "left";
        const label = snap.showServerNames ? t.name : `Server ${i + 1}`;
        ctx.fillStyle = COL.white;
        ctx.font = `600 28px ${FONT}`;
        ctx.fillText(truncate(ctx, label, barW), barX, rowY + 24);

        const trackH = 14;
        const trackY = rowY + 38;
        ctx.fillStyle = `rgba(${skin.glowSoftRgb}, 0.14)`;
        roundRectPath(ctx, barX, trackY, barW, trackH, 7);
        ctx.fill();

        const fillW = Math.max(trackH, (t.count / max) * barW);
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrad.addColorStop(0, skin.accentStrong);
        barGrad.addColorStop(1, skin.accentHi);
        ctx.fillStyle = barGrad;
        roundRectPath(ctx, barX, trackY, fillW, trackH, 7);
        ctx.fill();

        ctx.fillStyle = skin.blush;
        ctx.font = `600 26px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(t.count.toLocaleString(), WIDTH - PAD, rowY + 40);
        ctx.textAlign = "left";
    }

    return y + snap.top.length * rowH;
}

function drawStatTrio(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, skin: Skin, top: number): number {
    const cells: [string, string][] = [
        [`${snap.accountYear}`, "on Discord since"],
        [snap.guildCount.toLocaleString(), snap.guildCount === 1 ? "server" : "servers"],
        [snap.activeDays.toLocaleString(), snap.activeDays === 1 ? "active day" : "active days"]
    ];

    const gap = 18;
    const cardW = (CONTENT - gap * 2) / 3;
    const cardH = 116;

    for (let i = 0; i < cells.length; i++) {
        const x = PAD + i * (cardW + gap);
        ctx.fillStyle = `rgba(${skin.glowSoftRgb}, 0.06)`;
        roundRectPath(ctx, x, top, cardW, cardH, 24);
        ctx.fill();
        ctx.strokeStyle = `rgba(${skin.glowSoftRgb}, 0.12)`;
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, x, top, cardW, cardH, 24);
        ctx.stroke();

        const cx = x + cardW / 2;
        ctx.textAlign = "center";
        ctx.fillStyle = skin.accentHi;
        ctx.font = `800 54px ${FONT}`;
        ctx.fillText(cells[i][0], cx, top + 66);
        ctx.fillStyle = skin.faint;
        ctx.font = `500 23px ${FONT}`;
        ctx.fillText(cells[i][1], cx, top + 98);
    }

    return top + cardH;
}

function drawFooter(ctx: CanvasRenderingContext2D, cat: HTMLImageElement, snap: WrappedSnapshot, skin: Skin, top: number) {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    let y = top + 30;
    if (snap.peakDay !== null && snap.peakHour !== null) {
        const hour = snap.peakHour % 12 === 0 ? 12 : snap.peakHour % 12;
        const period = snap.peakHour < 12 ? "am" : "pm";
        ctx.fillStyle = skin.blush;
        ctx.font = `500 28px ${FONT}`;
        ctx.fillText(`Most active on ${DAY_NAMES[snap.peakDay]} around ${hour}${period}`, cx, y);
        y += 42;
    }

    ctx.fillStyle = skin.faint;
    ctx.font = `500 25px ${FONT}`;
    ctx.fillText(`${snap.pluginCount} plugins · ${snap.themeCount} themes active · ${snap.friendCount} friends`, cx, y);
    y += 54;

    const size = 40;
    const label = "kittycord.dev";
    ctx.font = `700 30px ${FONT}`;
    const labelW = ctx.measureText(label).width;
    const totalW = size + 14 + labelW;
    const startX = cx - totalW / 2;

    ctx.save();
    roundRectPath(ctx, startX, y - size + 8, size, size, 12);
    ctx.clip();
    ctx.drawImage(cat, startX, y - size + 8, size, size);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = COL.white;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(label, startX + size + 14, y);
}

const SHARE_W = 1200;
const SHARE_H = 630;

function drawShareBackground(ctx: CanvasRenderingContext2D, skin: Skin) {
    const bg = ctx.createLinearGradient(0, 0, 0, SHARE_H);
    bg.addColorStop(0, skin.bg[0]);
    bg.addColorStop(0.55, skin.bg[1]);
    bg.addColorStop(1, skin.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SHARE_W, SHARE_H);

    drawGlow(ctx, 90, 60, 420, skin.glowRgb, 0.22);
    drawGlow(ctx, SHARE_W - 60, SHARE_H - 50, 480, skin.glowRgb, 0.18);
    drawDiamond(ctx, SHARE_W - 80, 90, 130, `rgba(${skin.glowRgb}, 0.08)`);
    drawDiamond(ctx, 50, SHARE_H - 70, 110, `rgba(${skin.glowSoftRgb}, 0.05)`);

    const sparkles: [number, number, number, number][] = [
        [200, 150, 8, 0.7], [1010, 200, 7, 0.55], [260, 480, 6, 0.5],
        [950, 500, 10, 0.6], [620, 80, 6, 0.4]
    ];
    for (const [x, y, s, a] of sparkles) drawSparkle(ctx, x, y, s, a);

    roundRectPath(ctx, 16, 16, SHARE_W - 32, SHARE_H - 32, 44);
    ctx.strokeStyle = `rgba(${skin.glowSoftRgb}, 0.18)`;
    ctx.lineWidth = 2;
    ctx.stroke();
}

export async function renderShareCard(snap: WrappedSnapshot, skin: Skin = SKINS.year): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);

    const canvas = document.createElement("canvas");
    canvas.width = SHARE_W;
    canvas.height = SHARE_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";
    drawShareBackground(ctx, skin);

    const headerSize = 48;
    ctx.save();
    roundRectPath(ctx, 64, 52, headerSize, headerSize, 14);
    ctx.clip();
    ctx.drawImage(cat, 64, 52, headerSize, headerSize);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = COL.white;
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText("Kittycord", 64 + headerSize + 16, 78);
    ctx.fillStyle = skin.accentHi;
    ctx.fillText(` ${skin.title}`, 64 + headerSize + 16 + ctx.measureText("Kittycord").width, 78);
    ctx.fillStyle = skin.faint;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText(skin.subtitleShare, 64 + headerSize + 16, 102);

    const leftX = 300;
    ctx.textAlign = "center";
    ctx.font = `400 110px ${FONT}`;
    ctx.fillText(snap.vibe.emoji, leftX, 280);
    ctx.fillStyle = skin.faint;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText("MY VIBE", leftX, 326);
    ctx.fillStyle = COL.white;
    ctx.font = `800 60px ${FONT}`;
    ctx.fillText(snap.vibe.label, leftX, 388);

    ctx.fillStyle = skin.blush;
    ctx.font = `400 24px ${FONT}`;
    const lines = wrapText(ctx, snap.vibe.line, 440);
    let ly = 428;
    for (const line of lines) {
        ctx.fillText(line, leftX, ly);
        ly += 32;
    }

    const rightX = 850;
    ctx.fillStyle = skin.accentHi;
    ctx.font = `800 120px ${FONT}`;
    ctx.fillText(snap.messages.toLocaleString(), rightX, 300);
    ctx.fillStyle = COL.white;
    ctx.font = `600 30px ${FONT}`;
    ctx.fillText("messages sent", rightX, 344);

    ctx.fillStyle = skin.blush;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(`since ${snap.accountYear} on Discord · ${snap.guildCount.toLocaleString()} servers · ${snap.activeDays.toLocaleString()} active days`, rightX, 400);

    const since = new Date(snap.startedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    ctx.fillStyle = skin.faint;
    ctx.font = `400 20px ${FONT}`;
    ctx.fillText(`measuring since ${since}`, rightX, 434);

    const label = "kittycord.dev";
    ctx.font = `700 28px ${FONT}`;
    const labelW = ctx.measureText(label).width;
    const catSize = 36;
    const totalW = catSize + 12 + labelW;
    const startX = SHARE_W / 2 - totalW / 2;
    const footY = SHARE_H - 64;

    ctx.save();
    roundRectPath(ctx, startX, footY - catSize + 8, catSize, catSize, 10);
    ctx.clip();
    ctx.drawImage(cat, startX, footY - catSize + 8, catSize, catSize);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.fillStyle = COL.white;
    ctx.font = `700 28px ${FONT}`;
    ctx.fillText(label, startX + catSize + 12, footY);

    return canvasToBlob(canvas);
}

export async function renderCard(snap: WrappedSnapshot, skin: Skin = SKINS.year): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";

    drawBackground(ctx, skin);
    drawHeader(ctx, cat, skin);

    let y = 190;
    y = drawVibe(ctx, snap, skin, y);
    y = drawBigNumber(ctx, snap, skin, y + 24);
    y = drawTopServers(ctx, snap, skin, y + 44);
    y = drawStatTrio(ctx, snap, skin, y + 30);
    drawFooter(ctx, cat, snap, skin, y + 12);

    return canvasToBlob(canvas);
}
