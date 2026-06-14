/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { buildGhostUri, GHOST_ACCESSORIES, GhostExpression } from "./ghostArt";
import { PetConfig, PetHooks } from "./pet";

const BLINK_MIN = 3000;
const BLINK_MAX = 6500;
const SLEEP_AFTER = 18000;

export class GhostController {
    private hooks: PetHooks;
    private container: HTMLDivElement;
    private bob: HTMLDivElement;
    private body: HTMLImageElement;
    private raf: number | null = null;

    private x = 0;
    private y = 0;
    private targetX = 0;
    private targetY = 0;
    private lean = 0;
    private lastFrame = 0;
    private lastMeasure = 0;
    private state: "idle" | "fly" = "idle";
    private idleSince = 0;
    private nextHopAt = 0;
    private sleeping = false;
    private nextBlinkAt = 0;
    private blinkUntil = 0;
    private temp: GhostExpression | null = null;
    private tempUntil = 0;
    private minX = 8;
    private maxX = 300;
    private minY = 8;
    private maxY = 300;
    private equipped: string | null = null;
    private renderedExpr: GhostExpression | null = null;
    private renderedAcc: string | null = null;
    private lastSize = -1;
    private prevTX = NaN;
    private prevTY = NaN;
    private prevLean = "";

    constructor(hooks: PetHooks) {
        this.hooks = hooks;
        this.container = document.createElement("div");
        this.container.className = "kc-ghost";
        this.bob = document.createElement("div");
        this.bob.className = "kc-ghost-bob";
        this.body = document.createElement("img");
        this.body.className = "kc-ghost-body";
        this.body.alt = "";
        this.bob.appendChild(this.body);
        this.container.appendChild(this.bob);
        this.container.addEventListener("click", () => this.pet());
    }

    start() {
        this.measure();
        this.x = (this.minX + this.maxX) / 2;
        this.y = (this.minY + this.maxY) / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        const now = performance.now();
        this.lastFrame = now;
        this.idleSince = now;
        this.nextHopAt = now + 800;
        this.nextBlinkAt = now + BLINK_MIN;
        document.body.appendChild(this.container);
        this.loop();
    }

    stop() {
        if (this.raf !== null) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.container.remove();
    }

    setEquipped(accessory: string | null) {
        this.equipped = accessory && GHOST_ACCESSORIES[accessory] ? accessory : null;
    }

    react(kind: "mention" | "message" | "typing") {
        if (!this.hooks.getConfig().reactions) return;
        this.sleeping = false;
        if (kind === "mention") {
            this.setTemp("happy", 1500);
            this.spawnHearts();
        } else {
            this.setTemp("alert", kind === "message" ? 700 : 500);
        }
    }

    pet() {
        this.sleeping = false;
        this.setTemp("happy", 1600);
        this.spawnHearts();
        this.hooks.onPet();
    }

    private setTemp(expr: GhostExpression, ms: number) {
        this.temp = expr;
        this.tempUntil = performance.now() + ms;
    }

    private loop = () => {
        this.raf = requestAnimationFrame(this.loop);
        try {
            this.frame();
        } catch { /* never break the client over the ghost */ }
    };

    private measure() {
        const { size } = this.hooks.getConfig();
        const area = document.querySelector('main[class*="chatContent"]')
            ?? document.querySelector('[class*="channelTextArea"]')
            ?? document.querySelector('[class*="app-"]');
        if (area) {
            const rect = area.getBoundingClientRect();
            if (rect.width > size * 3 && rect.height > size * 3) {
                this.minX = rect.left + 8;
                this.maxX = rect.right - size - 8;
                this.minY = rect.top + 8;
                this.maxY = rect.bottom - size - 8;
                return;
            }
        }
        this.minX = 8;
        this.maxX = Math.max(8, window.innerWidth - size - 8);
        this.minY = 8;
        this.maxY = Math.max(8, window.innerHeight - size - 8);
    }

    private frame() {
        const now = performance.now();
        const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
        this.lastFrame = now;

        if (document.hidden) return;
        if (document.documentElement.classList.contains("kc-perf-noanim")) {
            this.container.style.display = "none";
            return;
        }
        this.container.style.display = "";

        const cfg = this.hooks.getConfig();
        if (now - this.lastMeasure > 1000) {
            this.measure();
            this.lastMeasure = now;
        }
        this.advance(cfg, now, dt);
        this.render(cfg, dt);
    }

    private advance(cfg: PetConfig, now: number, dt: number) {
        if (this.state === "fly") {
            const rate = 2.4 * cfg.speed;
            const k = 1 - Math.exp(-rate * dt);
            this.x += (this.targetX - this.x) * k;
            this.y += (this.targetY - this.y) * k;
            if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 3) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.state = "idle";
                this.idleSince = now;
                this.nextHopAt = now + 1200 + Math.random() * 2600;
            }
            return;
        }

        if (this.sleeping) {
            if (Math.random() < dt * 0.06) {
                this.sleeping = false;
                this.idleSince = now;
                this.nextHopAt = now + 600;
            }
            return;
        }

        if (now < this.nextHopAt) return;

        const r = Math.random();
        if (cfg.sleepWhenIdle && now - this.idleSince > SLEEP_AFTER && r < 0.3) {
            this.sleeping = true;
        } else if (r < 0.85) {
            this.targetX = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
            this.targetY = this.minY + Math.random() * Math.max(0, this.maxY - this.minY);
            this.state = "fly";
        } else {
            this.nextHopAt = now + 1000 + Math.random() * 2000;
        }
    }

    private render(cfg: PetConfig, dt: number) {
        const { size } = cfg;
        this.x = Math.min(Math.max(this.x, this.minX), this.maxX);
        this.y = Math.min(Math.max(this.y, this.minY), this.maxY);

        const dir = this.state === "fly" ? this.targetX - this.x : 0;
        const targetLean = Math.max(-12, Math.min(12, dir * 0.4));
        this.lean += (targetLean - this.lean) * Math.min(1, dt * 8);

        if (size !== this.lastSize) {
            this.container.style.width = `${size}px`;
            this.container.style.height = `${size}px`;
            this.lastSize = size;
        }

        const tx = Math.round(this.x);
        const ty = Math.round(this.y);
        if (tx !== this.prevTX || ty !== this.prevTY) {
            this.container.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
            this.prevTX = tx;
            this.prevTY = ty;
        }

        const leanStr = this.lean.toFixed(1);
        if (leanStr !== this.prevLean) {
            this.body.style.transform = `rotate(${leanStr}deg)`;
            this.prevLean = leanStr;
        }

        const expr = this.currentExpression(performance.now());
        if (expr !== this.renderedExpr || this.equipped !== this.renderedAcc) {
            this.body.src = buildGhostUri({ expression: expr, accessory: this.equipped });
            this.renderedExpr = expr;
            this.renderedAcc = this.equipped;
        }
    }

    private currentExpression(now: number): GhostExpression {
        if (this.temp && now < this.tempUntil) return this.temp;
        this.temp = null;
        if (this.sleeping) return "sleep";
        if (now >= this.nextBlinkAt) {
            this.blinkUntil = now + 130;
            this.nextBlinkAt = now + BLINK_MIN + Math.random() * (BLINK_MAX - BLINK_MIN);
        }
        return now < this.blinkUntil ? "blink" : "idle";
    }

    private spawnHearts() {
        const { size } = this.hooks.getConfig();
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const heart = document.createElement("span");
            heart.className = "kc-pet-heart";
            heart.textContent = "♥";
            heart.style.left = `${this.x + size * (0.2 + Math.random() * 0.6)}px`;
            heart.style.top = `${this.y - 4 - Math.random() * size * 0.4}px`;
            heart.style.animationDelay = `${i * 70}ms`;
            heart.addEventListener("animationend", () => heart.remove());
            document.body.appendChild(heart);
        }
    }
}
