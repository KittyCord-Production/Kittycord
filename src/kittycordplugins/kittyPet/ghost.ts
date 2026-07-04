/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getCursor } from "./cursor";
import { buildGhostUri, GHOST_ACCESSORIES, GhostExpression } from "./ghostArt";
import { burst, spawnHearts } from "./hearts";
import { PetConfig, PetHooks } from "./pet";
import { watchSuspend } from "./suspend";

export interface PetArt {
    build(opts: { expression: GhostExpression; accessory: string | null; }): string;
    accessories: Record<string, unknown>;
}

const GHOST_ART: PetArt = { build: buildGhostUri, accessories: GHOST_ACCESSORIES };

const BLINK_MIN = 3000;
const BLINK_MAX = 6500;
const SLEEP_AFTER = 18000;

export class GhostController {
    private hooks: PetHooks;
    private art: PetArt;
    private container: HTMLDivElement;
    private bob: HTMLDivElement;
    private body: HTMLImageElement;
    private raf: number | null = null;
    private disposeSuspend: (() => void) | null = null;

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
    private nameEl: HTMLDivElement;
    private renderedName = "";
    private lastPetDay = "";
    private renderedWants: boolean | null = null;
    private luring = false;
    private treatEl: HTMLDivElement | null = null;
    private onClick = (e: MouseEvent) => {
        if (this.hooks.getConfig().followCursor) return;
        const r = this.container.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) this.pet();
    };

    constructor(hooks: PetHooks, art: PetArt = GHOST_ART) {
        this.hooks = hooks;
        this.art = art;
        this.container = document.createElement("div");
        this.container.className = "kc-ghost";
        this.bob = document.createElement("div");
        this.bob.className = "kc-ghost-bob";
        this.body = document.createElement("img");
        this.body.className = "kc-ghost-body";
        this.body.alt = "";
        this.nameEl = document.createElement("div");
        this.nameEl.className = "kc-pet-name";
        this.nameEl.style.display = "none";
        this.bob.appendChild(this.body);
        this.container.appendChild(this.bob);
        this.container.appendChild(this.nameEl);
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
        document.addEventListener("click", this.onClick);
        this.disposeSuspend = watchSuspend(suspended => {
            if (suspended) {
                this.stopLoop();
                this.container.style.display = "none";
            } else {
                this.container.style.display = "";
                if (this.raf === null) {
                    this.lastFrame = performance.now();
                    this.loop();
                }
            }
        });
    }

    stop() {
        this.disposeSuspend?.();
        this.disposeSuspend = null;
        this.stopLoop();
        this.removeTreat();
        document.removeEventListener("click", this.onClick);
        this.container.remove();
    }

    private stopLoop() {
        if (this.raf !== null) cancelAnimationFrame(this.raf);
        this.raf = null;
    }

    setEquipped(accessory: string | null) {
        this.equipped = accessory && this.art.accessories[accessory] ? accessory : null;
    }

    setName(name: string) {
        if (name !== this.renderedName) {
            this.nameEl.textContent = name;
            this.renderedName = name;
        }
        this.nameEl.style.display = name ? "" : "none";
    }

    setTint(filter: string) {
        this.body.style.filter = filter;
    }

    setAura(color: string) {
        this.container.style.setProperty("--kc-aura", color);
    }

    setLastPetDay(day: string) {
        this.lastPetDay = day;
        this.updateWants();
    }

    private updateWants() {
        const wants = this.lastPetDay !== new Date().toDateString();
        if (wants !== this.renderedWants) {
            this.container.classList.toggle("kc-pet-wants", wants);
            this.renderedWants = wants;
        }
    }

    react(kind: "mention" | "message" | "typing" | "reaction" | "stream") {
        if (!this.hooks.getConfig().reactions) return;
        this.sleeping = false;
        if (kind === "mention") {
            this.setTemp("happy", 1500);
            const { size } = this.hooks.getConfig();
            spawnHearts(this.x + size * 0.5, this.y, 3 + Math.floor(Math.random() * 3));
        } else if (kind === "stream") {
            this.setTemp("love", 1500);
            const { size } = this.hooks.getConfig();
            spawnHearts(this.x + size * 0.5, this.y, 3 + Math.floor(Math.random() * 3));
        } else if (kind === "reaction") {
            this.setTemp("alert", 700);
        } else {
            this.setTemp("alert", kind === "message" ? 700 : 500);
        }
    }

    pet() {
        this.sleeping = false;
        this.setTemp("love", 1600);
        const { size } = this.hooks.getConfig();
        spawnHearts(this.x + size * 0.5, this.y, 3 + Math.floor(Math.random() * 3));
        this.hooks.onPet();
    }

    lure(point: { x: number; y: number; }) {
        if (document.documentElement.classList.contains("kc-perf-noanim")) return;
        this.sleeping = false;
        const tx = Math.min(Math.max(point.x, this.minX), this.maxX);
        const ty = Math.min(Math.max(point.y, this.minY), this.maxY);
        const { size } = this.hooks.getConfig();
        this.spawnTreat(tx, ty, size);
        this.targetX = tx;
        this.targetY = ty;
        this.luring = true;
        this.state = "fly";
    }

    getDropPoint(): { x: number; y: number; } {
        const x = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
        const y = this.minY + Math.random() * Math.max(0, this.maxY - this.minY);
        return { x, y };
    }

    celebrate(_level: number) {
        this.sleeping = false;
        this.setTemp("love", 2000);
        const { size } = this.hooks.getConfig();
        burst(this.x + size * 0.5, this.y, 16);
    }

    private spawnTreat(x: number, y: number, size: number) {
        this.removeTreat();
        const el = document.createElement("div");
        el.className = "kc-pet-treat";
        el.textContent = Math.random() < 0.5 ? "🍪" : "🎾";
        el.style.fontSize = `${Math.round(size * 0.7)}px`;
        el.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
        document.body.appendChild(el);
        this.treatEl = el;
    }

    private removeTreat() {
        this.treatEl?.remove();
        this.treatEl = null;
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
        if (document.documentElement.matches(".kc-perf-noanim, .kc-idle")) {
            this.container.style.display = "none";
            return;
        }
        this.container.style.display = "";

        const cfg = this.hooks.getConfig();
        if (now - this.lastMeasure > 1000) {
            this.measure();
            this.updateWants();
            this.lastMeasure = now;
        }
        this.advance(cfg, now, dt);
        this.render(cfg, dt);
    }

    private advance(cfg: PetConfig, now: number, dt: number) {
        if (cfg.followCursor) {
            const c = getCursor();
            this.targetX = Math.min(Math.max(c.x + 4, this.minX), this.maxX);
            this.targetY = Math.min(Math.max(c.y + 4, this.minY), this.maxY);
            const k = 1 - Math.exp(-6 * cfg.speed * dt);
            this.x += (this.targetX - this.x) * k;
            this.y += (this.targetY - this.y) * k;
            this.sleeping = false;
            this.luring = false;
            this.removeTreat();
            this.state = "fly";
            return;
        }

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
                if (this.luring) {
                    this.luring = false;
                    this.removeTreat();
                    this.setTemp("love", 1600);
                    spawnHearts(this.x + cfg.size * 0.5, this.y, 3 + Math.floor(Math.random() * 3));
                }
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
            this.body.src = this.art.build({ expression: expr, accessory: this.equipped });
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
}
