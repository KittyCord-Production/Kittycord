/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ACCESSORIES, ACCESSORY_URIS, AnimationName, ANIMATIONS, SHEET, SITTING, SPRITE_SIZE } from "./sprites";

export interface PetConfig {
    size: number;
    speed: number;
    reactions: boolean;
    sleepWhenIdle: boolean;
}

export interface PetHooks {
    getConfig(): PetConfig;
    onPet(): void;
}

const TICK_MS = 100;
const FRAME_TICKS = 2;
const BOUNDS_TICKS = 20;

type State = "idle" | "walk" | "groom" | "itch" | "tired" | "sleep" | "alert" | "happy";

const STATE_ANIM: Record<State, AnimationName> = {
    idle: "idle",
    walk: "walkR",
    groom: "groom",
    itch: "itch",
    tired: "tired",
    sleep: "sleep",
    alert: "alert",
    happy: "tired"
};

export class PetController {
    private hooks: PetHooks;
    private container: HTMLDivElement;
    private sprite: HTMLDivElement;
    private accessoryEl: HTMLImageElement;
    private timer: ReturnType<typeof setInterval> | null = null;
    private onResize = () => { this.measure(); };

    private state: State = "idle";
    private stateTicks = 0;
    private idleTicks = 0;
    private frame = 0;
    private tick = 0;
    private x = 120;
    private bounceTicks = 0;
    private targetX = 120;
    private dir: 1 | -1 = 1;
    private minX = 0;
    private maxX = 300;
    private floorY = 300;
    private equipped: string | null = null;

    constructor(hooks: PetHooks) {
        this.hooks = hooks;
        this.container = document.createElement("div");
        this.container.className = "kc-pet";
        this.sprite = document.createElement("div");
        this.sprite.className = "kc-pet-sprite";
        this.sprite.style.backgroundImage = `url(${SHEET})`;
        this.accessoryEl = document.createElement("img");
        this.accessoryEl.className = "kc-pet-acc";
        this.accessoryEl.alt = "";
        this.container.appendChild(this.sprite);
        this.container.appendChild(this.accessoryEl);
        this.container.addEventListener("click", () => this.pet());
    }

    start() {
        this.measure();
        this.x = this.minX + (this.maxX - this.minX) * (0.3 + Math.random() * 0.4);
        window.addEventListener("resize", this.onResize);
        document.body.appendChild(this.container);
        this.timer = setInterval(() => {
            try {
                this.onTick();
            } catch { /* never break the client over the cat */ }
        }, TICK_MS);
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        window.removeEventListener("resize", this.onResize);
        this.container.remove();
    }

    setEquipped(accessory: string | null) {
        this.equipped = accessory && ACCESSORIES[accessory] ? accessory : null;
    }

    react(kind: "mention" | "message" | "typing") {
        if (!this.hooks.getConfig().reactions) return;
        if (kind === "mention") {
            this.setState("alert", 18);
            this.bounceTicks = 6;
        } else if (this.state === "idle" || this.state === "sleep" || this.state === "tired") {
            this.setState("alert", kind === "message" ? 8 : 5);
        }
    }

    pet() {
        this.setState("happy", 16);
        this.spawnHearts();
        this.hooks.onPet();
    }

    private setState(state: State, ticks = 0) {
        this.state = state;
        this.stateTicks = ticks;
        this.frame = 0;
        if (state !== "idle") this.idleTicks = 0;
    }

    private measure() {
        const { size } = this.hooks.getConfig();
        const area = document.querySelector('main[class*="chatContent"]')
            ?? document.querySelector('[class*="channelTextArea"]')
            ?? document.querySelector('[class*="app-"]');
        if (area) {
            const rect = area.getBoundingClientRect();
            if (rect.width > size * 3 && rect.height > size) {
                this.minX = rect.left + 4;
                this.maxX = rect.right - size - 4;
                this.floorY = rect.bottom - size;
                return;
            }
        }
        this.minX = 4;
        this.maxX = Math.max(4, window.innerWidth - size - 4);
        this.floorY = window.innerHeight - size - 4;
    }

    private onTick() {
        if (document.hidden) return;
        if (document.documentElement.classList.contains("kc-perf-noanim")) {
            this.container.style.display = "none";
            return;
        }
        this.container.style.display = "";

        this.tick++;
        if (this.tick % BOUNDS_TICKS === 0) this.measure();

        const cfg = this.hooks.getConfig();
        this.advanceState(cfg);
        this.render(cfg);
    }

    private advanceState(cfg: PetConfig) {
        if (this.stateTicks > 0) {
            this.stateTicks--;
            if (this.stateTicks === 0) {
                if (this.state === "tired" && cfg.sleepWhenIdle) this.setState("sleep");
                else this.setState("idle");
            }
            return;
        }

        if (this.state === "sleep") {
            if (Math.random() < 0.001) this.setState("idle");
            return;
        }

        if (this.state === "walk") {
            const step = Math.max(1, 2 * cfg.speed);
            const remaining = this.targetX - this.x;
            if (Math.abs(remaining) <= step) {
                this.x = this.targetX;
                this.setState("idle");
            } else {
                this.dir = remaining > 0 ? 1 : -1;
                this.x += step * this.dir;
            }
            return;
        }

        this.idleTicks++;
        if (this.idleTicks < 40) return;
        if (Math.random() > 0.02) return;

        const roll = Math.random();
        if (roll < 0.55) {
            this.targetX = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
            this.setState("walk");
        } else if (roll < 0.7) {
            this.setState("groom", 24);
        } else if (roll < 0.8) {
            this.setState("itch", 16);
        } else if (cfg.sleepWhenIdle && this.idleTicks > 300) {
            this.setState("tired", 20);
        } else {
            this.idleTicks = 0;
        }
    }

    private render(cfg: PetConfig) {
        const { size } = cfg;
        const anim = this.state === "walk"
            ? (this.dir === 1 ? "walkR" : "walkL")
            : STATE_ANIM[this.state];
        const frames = ANIMATIONS[anim];
        if (this.tick % FRAME_TICKS === 0) this.frame++;
        const [fx, fy] = frames[this.frame % frames.length];

        this.x = Math.min(Math.max(this.x, this.minX), this.maxX);
        let y = this.floorY;
        if (this.bounceTicks > 0) {
            this.bounceTicks--;
            y -= Math.round(Math.sin((this.bounceTicks / 6) * Math.PI) * size * 0.4);
        }

        this.container.style.width = `${size}px`;
        this.container.style.height = `${size}px`;
        this.container.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(y)}px, 0)`;
        this.sprite.style.backgroundSize = `${size * 8}px ${size * 4}px`;
        const cell = size / SPRITE_SIZE;
        this.sprite.style.backgroundPosition = `${fx * size}px ${fy * size}px`;

        const acc = this.equipped ? ACCESSORIES[this.equipped] : null;
        if (acc && SITTING.has(anim)) {
            const width = Math.max(...acc.grid.map(r => r.length));
            this.accessoryEl.src = ACCESSORY_URIS[this.equipped!];
            this.accessoryEl.style.display = "";
            this.accessoryEl.style.left = `${acc.x * cell}px`;
            this.accessoryEl.style.top = `${acc.y * cell}px`;
            this.accessoryEl.style.width = `${width * cell}px`;
        } else {
            this.accessoryEl.style.display = "none";
        }
    }

    private spawnHearts() {
        const { size } = this.hooks.getConfig();
        const count = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            const heart = document.createElement("span");
            heart.className = "kc-pet-heart";
            heart.textContent = "♥";
            heart.style.left = `${this.x + size * (0.2 + Math.random() * 0.6)}px`;
            heart.style.top = `${this.floorY - 4 - Math.random() * size * 0.5}px`;
            heart.style.animationDelay = `${i * 70}ms`;
            heart.addEventListener("animationend", () => heart.remove());
            document.body.appendChild(heart);
        }
    }
}
