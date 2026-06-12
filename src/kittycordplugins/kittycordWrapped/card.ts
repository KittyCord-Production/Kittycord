/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BRAND_ICON } from "../../branding";
import type { WrappedSnapshot } from "./storage";

const WIDTH = 1080;
const HEIGHT = 1500;
const PAD = 72;
const CONTENT = WIDTH - PAD * 2;

const FONT = `"gg sans", "Inter", "Helvetica Neue", Arial, sans-serif`;

const COL = {
    pink: "#ff5fa6",
    pinkHi: "#ff8ac4",
    pinkStrong: "#f0509b",
    blush: "#d6a4c0",
    faint: "#9a7389",
    white: "#ffffff"
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) return reject(new Error("Failed to create Blob"));
            resolve(blob);
        }, "image/png");
    });
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rgb: string, alpha: number) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
    ctx.strokeStyle = `rgba(255, 138, 196, ${alpha})`;
    ctx.lineWidth = Math.max(2, size / 3);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxWidth && line) {
            lines.push(line);
            line = w;
        } else {
            line = test;
        }
    }
    if (line) lines.push(line);
    return lines;
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
}

function drawBackground(ctx: CanvasRenderingContext2D) {
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, "#1b1018");
    bg.addColorStop(0.5, "#130b11");
    bg.addColorStop(1, "#0b0608");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawGlow(ctx, 120, 80, 540, "255, 95, 166", 0.22);
    drawGlow(ctx, WIDTH - 60, HEIGHT - 120, 660, "240, 80, 155", 0.18);
    drawGlow(ctx, WIDTH - 120, 380, 380, "255, 138, 196", 0.1);

    drawDiamond(ctx, WIDTH - 70, 150, 150, "rgba(255, 95, 166, 0.08)");
    drawDiamond(ctx, 40, HEIGHT - 380, 200, "rgba(255, 138, 196, 0.05)");

    const sparkles: [number, number, number, number][] = [
        [180, 250, 9, 0.8], [880, 320, 7, 0.55], [240, 760, 6, 0.5],
        [930, 840, 11, 0.6], [120, 1040, 7, 0.45], [965, 1180, 8, 0.5],
        [620, 200, 6, 0.4], [820, 1300, 9, 0.55]
    ];
    for (const [x, y, s, a] of sparkles) drawSparkle(ctx, x, y, s, a);

    roundRectPath(ctx, 20, 20, WIDTH - 40, HEIGHT - 40, 56);
    ctx.strokeStyle = "rgba(255, 138, 196, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, cat: HTMLImageElement) {
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
    ctx.fillStyle = COL.pinkHi;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(" Wrapped", PAD + size + 20 + ctx.measureText("Kittycord").width, y + 30);

    ctx.fillStyle = COL.faint;
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText("your year on Discord, the cozy way", PAD + size + 20, y + 58);
}

function drawVibe(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, top: number): number {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    ctx.font = `400 128px ${FONT}`;
    ctx.fillText(snap.vibe.emoji, cx, top + 116);

    ctx.fillStyle = COL.faint;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText("YOUR VIBE", cx, top + 166);

    ctx.fillStyle = COL.white;
    ctx.font = `800 86px ${FONT}`;
    ctx.fillText(snap.vibe.label, cx, top + 248);

    ctx.fillStyle = COL.blush;
    ctx.font = `400 32px ${FONT}`;
    const lines = wrapText(ctx, snap.vibe.line, CONTENT - 60);
    let y = top + 298;
    for (const line of lines) {
        ctx.fillText(line, cx, y);
        y += 42;
    }
    return y + 4;
}

function drawBigNumber(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, top: number): number {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    ctx.fillStyle = COL.pinkHi;
    ctx.font = `800 148px ${FONT}`;
    ctx.fillText(snap.messages.toLocaleString(), cx, top + 120);

    ctx.fillStyle = COL.white;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText("messages sent", cx, top + 166);

    const since = new Date(snap.startedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    ctx.fillStyle = COL.faint;
    ctx.font = `400 24px ${FONT}`;
    ctx.fillText(`measuring since ${since}`, cx, top + 202);

    return top + 230;
}

function drawTopServers(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, top: number): number {
    ctx.textAlign = "left";
    ctx.fillStyle = COL.faint;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText("TOP SERVERS", PAD, top);

    const y = top + 30;
    if (!snap.top.length) {
        ctx.fillStyle = COL.blush;
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
        grad.addColorStop(0, COL.pink);
        grad.addColorStop(1, COL.pinkStrong);
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
        ctx.fillStyle = "rgba(255, 138, 196, 0.14)";
        roundRectPath(ctx, barX, trackY, barW, trackH, 7);
        ctx.fill();

        const fillW = Math.max(trackH, (t.count / max) * barW);
        const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
        barGrad.addColorStop(0, COL.pinkStrong);
        barGrad.addColorStop(1, COL.pinkHi);
        ctx.fillStyle = barGrad;
        roundRectPath(ctx, barX, trackY, fillW, trackH, 7);
        ctx.fill();

        ctx.fillStyle = COL.blush;
        ctx.font = `600 26px ${FONT}`;
        ctx.textAlign = "right";
        ctx.fillText(t.count.toLocaleString(), WIDTH - PAD, rowY + 40);
        ctx.textAlign = "left";
    }

    return y + snap.top.length * rowH;
}

function drawStatTrio(ctx: CanvasRenderingContext2D, snap: WrappedSnapshot, top: number): number {
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
        ctx.fillStyle = "rgba(255, 138, 196, 0.06)";
        roundRectPath(ctx, x, top, cardW, cardH, 24);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 138, 196, 0.12)";
        ctx.lineWidth = 1.5;
        roundRectPath(ctx, x, top, cardW, cardH, 24);
        ctx.stroke();

        const cx = x + cardW / 2;
        ctx.textAlign = "center";
        ctx.fillStyle = COL.pinkHi;
        ctx.font = `800 54px ${FONT}`;
        ctx.fillText(cells[i][0], cx, top + 66);
        ctx.fillStyle = COL.faint;
        ctx.font = `500 23px ${FONT}`;
        ctx.fillText(cells[i][1], cx, top + 98);
    }

    return top + cardH;
}

function drawFooter(ctx: CanvasRenderingContext2D, cat: HTMLImageElement, snap: WrappedSnapshot, top: number) {
    const cx = WIDTH / 2;
    ctx.textAlign = "center";

    let y = top + 30;
    if (snap.peakDay !== null && snap.peakHour !== null) {
        const hour = snap.peakHour % 12 === 0 ? 12 : snap.peakHour % 12;
        const period = snap.peakHour < 12 ? "am" : "pm";
        ctx.fillStyle = COL.blush;
        ctx.font = `500 28px ${FONT}`;
        ctx.fillText(`Most active on ${DAY_NAMES[snap.peakDay]} around ${hour}${period}`, cx, y);
        y += 42;
    }

    ctx.fillStyle = COL.faint;
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

export async function renderCard(snap: WrappedSnapshot): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";

    drawBackground(ctx);
    drawHeader(ctx, cat);

    let y = 190;
    y = drawVibe(ctx, snap, y);
    y = drawBigNumber(ctx, snap, y + 24);
    y = drawTopServers(ctx, snap, y + 44);
    y = drawStatTrio(ctx, snap, y + 30);
    drawFooter(ctx, cat, snap, y + 12);

    return canvasToBlob(canvas);
}
