/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { getCursor } from "./cursor";
import { burst, spawnHearts } from "./hearts";
import { ACCESSORIES, ACCESSORY_URIS, AnimationName, ANIMATIONS, SHEET, SITTING, SPRITE_SIZE } from "./sprites";

export interface PetConfig {
    size: number;
    speed: number;
    reactions: boolean;
    sleepWhenIdle: boolean;
    followCursor: boolean;
}

export interface PetHooks {
    getConfig(): PetConfig;
    onPet(): void;
}

const TICK_MS = 100;
const FRAME_TICKS = 2;
const BOUNDS_TICKS = 20;

type State = "idle" | "walk" | "groom" | "itch" | "tired" | "sleep" | "alert" | "happy" | "play" | "zoom";

const STATE_ANIM: Record<State, AnimationName> = {
    idle: "idle",
    walk: "walkR",
    groom: "groom",
    itch: "itch",
    tired: "tired",
    sleep: "sleep",
    alert: "alert",
    happy: "tired",
    play: "alert",
    zoom: "walkR"
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
    private nameEl: HTMLDivElement;
    private renderedName = "";
    private lastPetDay = "";
    private renderedWants: boolean | null = null;
    private luring = false;
    private treatEl: HTMLDivElement | null = null;
    private nextZoomAt = 1200;
    private zoomReturn = 0;
    private zoomPhase: 0 | 1 = 0;

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
        this.nameEl = document.createElement("div");
        this.nameEl.className = "kc-pet-name";
        this.nameEl.style.display = "none";
        this.container.appendChild(this.sprite);
        this.container.appendChild(this.accessoryEl);
        this.container.appendChild(this.nameEl);
        this.container.addEventListener("click", () => this.pet());
    }

    start() {
        this.measure();
        this.x = this.minX + (this.maxX - this.minX) * (0.3 + Math.random() * 0.4);
        this.targetX = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
        this.setState("walk");
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
        this.removeTreat();
        this.container.remove();
    }

    setEquipped(accessory: string | null) {
        this.equipped = accessory && ACCESSORIES[accessory] ? accessory : null;
    }

    setName(name: string) {
        if (name !== this.renderedName) {
            this.nameEl.textContent = name;
            this.renderedName = name;
        }
        this.nameEl.style.display = name ? "" : "none";
    }

    setTint(filter: string) {
        this.sprite.style.filter = filter;
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
        if (kind === "mention") {
            this.setState("alert", 18);
            this.bounceTicks = 6;
        } else if (kind === "stream") {
            this.setState("alert", 14);
            this.bounceTicks = 8;
        } else if (kind === "reaction") {
            if (this.state === "idle" || this.state === "sleep" || this.state === "tired") this.setState("alert", 6);
        } else if (this.state === "idle" || this.state === "sleep" || this.state === "tired") {
            this.setState("alert", kind === "message" ? 8 : 5);
        }
    }

    pet() {
        this.setState("happy", 16);
        const { size } = this.hooks.getConfig();
        spawnHearts(this.x + size * 0.5, this.floorY, 3 + Math.floor(Math.random() * 3));
        this.hooks.onPet();
    }

    lure(point: { x: number; y: number; }) {
        if (document.documentElement.classList.contains("kc-perf-noanim")) return;
        const { size } = this.hooks.getConfig();
        const x = Math.min(Math.max(point.x, this.minX), this.maxX);
        this.spawnTreat(x, this.floorY, size);
        this.targetX = x;
        this.luring = true;
        this.setState("walk");
    }

    getDropPoint(): { x: number; y: number; } {
        const x = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
        return { x, y: this.floorY };
    }

    celebrate(_level: number) {
        this.setState("happy", 22);
        this.bounceTicks = 14;
        const { size } = this.hooks.getConfig();
        burst(this.x + size * 0.5, this.floorY, 16);
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

    private startZoom() {
        this.zoomReturn = this.x;
        this.zoomPhase = 0;
        this.targetX = (this.x - this.minX) < (this.maxX - this.x) ? this.maxX : this.minX;
        this.nextZoomAt = this.tick + 1800;
        this.setState("zoom");
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
        if (document.documentElement.matches(".kc-perf-noanim, .kc-idle")) {
            this.container.style.display = "none";
            return;
        }
        this.container.style.display = "";

        this.tick++;
        if (this.tick % BOUNDS_TICKS === 0) {
            this.measure();
            this.updateWants();
        }

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

        if (cfg.followCursor) {
            this.luring = false;
            this.removeTreat();
            this.targetX = Math.min(Math.max(getCursor().x - cfg.size / 2, this.minX), this.maxX);
            const step = Math.max(1, 3 * cfg.speed);
            const remaining = this.targetX - this.x;
            if (Math.abs(remaining) > step) {
                this.dir = remaining > 0 ? 1 : -1;
                this.x += step * this.dir;
                if (this.state !== "walk") this.setState("walk");
            } else if (this.state === "walk") {
                this.setState("idle");
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
                if (this.luring) {
                    this.luring = false;
                    this.removeTreat();
                    this.setState("play", 16);
                    this.bounceTicks = 8;
                    spawnHearts(this.x + cfg.size * 0.5, this.floorY, 3 + Math.floor(Math.random() * 3));
                } else {
                    this.setState("idle");
                }
            } else {
                this.dir = remaining > 0 ? 1 : -1;
                this.x += step * this.dir;
            }
            return;
        }

        if (this.state === "zoom") {
            const step = Math.max(3, 7 * cfg.speed);
            const remaining = this.targetX - this.x;
            if (Math.abs(remaining) <= step) {
                this.x = this.targetX;
                if (this.zoomPhase === 0) {
                    this.zoomPhase = 1;
                    this.targetX = this.zoomReturn;
                } else {
                    this.setState("idle");
                }
            } else {
                this.dir = remaining > 0 ? 1 : -1;
                this.x += step * this.dir;
            }
            return;
        }

        this.idleTicks++;
        if (this.idleTicks < 30) return;
        if (this.idleTicks > 60 && this.tick >= this.nextZoomAt && Math.random() < 0.004) {
            this.startZoom();
            return;
        }
        if (Math.random() > 0.03) return;

        const roll = Math.random();
        if (roll < 0.55) {
            this.targetX = this.minX + Math.random() * Math.max(0, this.maxX - this.minX);
            this.setState("walk");
        } else if (roll < 0.66) {
            this.setState("alert", 10);
        } else if (roll < 0.80) {
            this.setState("groom", roll < 0.73 ? 24 : 44);
        } else if (roll < 0.88) {
            this.setState("itch", 16);
        } else if (cfg.sleepWhenIdle && this.idleTicks > 300) {
            this.setState("tired", 20);
        } else {
            this.idleTicks = 0;
        }
    }

    private render(cfg: PetConfig) {
        const { size } = cfg;
        const anim = (this.state === "walk" || this.state === "zoom")
            ? (this.dir === 1 ? "walkR" : "walkL")
            : STATE_ANIM[this.state];
        const frames = ANIMATIONS[anim];
        const frameTicks = this.state === "zoom" ? 1 : FRAME_TICKS;
        if (this.tick % frameTicks === 0) this.frame++;
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
}
