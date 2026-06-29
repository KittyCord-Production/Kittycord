/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const FONT = "\"gg sans\", \"Inter\", \"Helvetica Neue\", Arial, sans-serif";

export const COL = {
    pink: "#ff5fa6",
    pinkHi: "#ff8ac4",
    pinkStrong: "#f0509b",
    blush: "#d6a4c0",
    faint: "#9a7389",
    white: "#ffffff"
};

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) return reject(new Error("Failed to create Blob"));
            resolve(blob);
        }, "image/png");
    });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = src;
    });
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

export function drawGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, rgb: string, alpha: number) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

export function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, alpha: number) {
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

export function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, half: number, fill: string) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(cx, cy - half);
    ctx.lineTo(cx + half, cy);
    ctx.lineTo(cx, cy + half);
    ctx.lineTo(cx - half, cy);
    ctx.closePath();
    ctx.fill();
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

export function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
    return `${t}…`;
}

export async function loadImageCors(url: string): Promise<HTMLImageElement | null> {
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

export function drawCardBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1b1018");
    bg.addColorStop(0.55, "#130b11");
    bg.addColorStop(1, "#0b0608");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    drawGlow(ctx, 90, 60, 420, "255, 95, 166", 0.22);
    drawGlow(ctx, w - 60, h - 50, 480, "240, 80, 155", 0.18);

    drawDiamond(ctx, w - 80, 90, 130, "rgba(255, 95, 166, 0.08)");
    drawDiamond(ctx, 50, h - 70, 110, "rgba(255, 138, 196, 0.05)");

    const sparkles: [number, number, number, number][] = [
        [w * 0.15, h * 0.22, 8, 0.7], [w * 0.85, h * 0.29, 7, 0.55], [w * 0.20, h * 0.79, 6, 0.5],
        [w * 0.82, h * 0.75, 10, 0.6], [w * 0.52, h * 0.14, 6, 0.4], [w * 0.70, h * 0.89, 7, 0.5]
    ];
    for (const [x, y, s, a] of sparkles) drawSparkle(ctx, x, y, s, a);

    roundRectPath(ctx, 16, 16, w - 32, h - 32, 44);
    ctx.strokeStyle = "rgba(255, 138, 196, 0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();
}

export function drawFooterPill(ctx: CanvasRenderingContext2D, cx: number, pillY: number, label: string, cat: CanvasImageSource) {
    const pillH = 72;
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
}
