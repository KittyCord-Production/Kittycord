/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";

import { COL } from "../_shared/canvasKit";
import { isSuspended } from "./suspend";

const logger = new Logger("KittyPet");

interface Heart {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    size: number;
    glyph: string;
    color: string;
}

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let raf: number | null = null;
let last = 0;
let dpr = 1;
const hearts: Heart[] = [];

function sizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
}

const onResize = () => {
    try {
        sizeCanvas();
    } catch (err) {
        logger.error("Heart frame failed", err);
    }
};

export function startHearts() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "kc-hearts";
    ctx = canvas.getContext("2d");
    document.body.appendChild(canvas);
    sizeCanvas();
    window.addEventListener("resize", onResize);
}

export function stopHearts() {
    if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
    }
    window.removeEventListener("resize", onResize);
    hearts.length = 0;
    canvas?.remove();
    canvas = null;
    ctx = null;
}

export function spawnHearts(x: number, y: number, count: number) {
    if (!canvas || !ctx) return;
    for (let i = 0; i < count; i++) {
        hearts.push({
            x: x + (Math.random() - 0.5) * 22,
            y: y - Math.random() * 8,
            vx: 0,
            vy: -(26 + Math.random() * 14),
            life: -i * 0.07,
            max: 0.9,
            size: 13 + Math.random() * 4,
            glyph: "♥",
            color: COL.pink
        });
    }
    last = performance.now();
    if (raf === null) raf = requestAnimationFrame(tick);
}

const BURST_GLYPHS = ["♥", "✨", "★"];

export function burst(x: number, y: number, count: number) {
    if (!canvas || !ctx) return;
    if (document.documentElement.classList.contains("kc-perf-noanim")) return;
    for (let i = 0; i < count; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5;
        const speed = 45 + Math.random() * 70;
        hearts.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: -i * 0.015,
            max: 1.1 + Math.random() * 0.3,
            size: 12 + Math.random() * 9,
            glyph: BURST_GLYPHS[i % BURST_GLYPHS.length],
            color: Math.random() < 0.5 ? COL.pink : COL.pinkHi
        });
    }
    last = performance.now();
    if (raf === null) raf = requestAnimationFrame(tick);
}

function tick(now: number) {
    try {
        if (!ctx || !canvas) {
            raf = null;
            return;
        }
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        if (isSuspended()) {
            hearts.length = 0;
            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
            raf = null;
            return;
        }
        if (document.hidden) {
            raf = requestAnimationFrame(tick);
            return;
        }

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        for (let i = hearts.length - 1; i >= 0; i--) {
            const h = hearts[i];
            h.life += dt;
            if (h.life < 0) continue;
            h.x += h.vx * dt;
            h.y += h.vy * dt;
            if (h.life >= h.max) {
                hearts.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = 1 - h.life / h.max;
            ctx.fillStyle = h.color;
            ctx.font = `${h.size}px sans-serif`;
            ctx.fillText(h.glyph, h.x, h.y);
        }
        ctx.globalAlpha = 1;

        raf = hearts.length ? requestAnimationFrame(tick) : null;
    } catch {
        stopHearts();
    }
}
