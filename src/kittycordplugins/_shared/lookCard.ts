/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconUtils, UserStore } from "@webpack/common";

import { BRAND_ICON } from "../../branding";
import { assetUrl, byId } from "../kittyDeko/catalog";
import { canvasToBlob, COL, drawCardBackground, drawFooterPill, FONT, loadImage, loadImageCors, roundRectPath, truncate } from "./canvasKit";

const WIDTH = 1200;
const HEIGHT = 630;

export const LOOK_FILENAME = "kittycord-look.png";

const ZWJ = String.fromCharCode(0x200d);
const VARIATION = new RegExp(String.fromCharCode(0xfe0f), "g");
const TWEMOJI_BASE = "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/svg/";

function twemojiUrl(emoji: string): string {
    const text = emoji.indexOf(ZWJ) < 0 ? emoji.replace(VARIATION, "") : emoji;
    const points: string[] = [];
    let high = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (high) {
            points.push((0x10000 + ((high - 0xd800) << 10) + (c - 0xdc00)).toString(16));
            high = 0;
        } else if (c >= 0xd800 && c <= 0xdbff) {
            high = c;
        } else {
            points.push(c.toString(16));
        }
    }
    return `${TWEMOJI_BASE}${points.join("-")}.svg`;
}

export interface LookBadge {
    emoji: string;
    label: string;
}

export interface LookData {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    color1?: string;
    color2?: string;
    dekoId?: string;
    badges: LookBadge[];
}

interface Chip {
    icon: HTMLImageElement | null;
    emoji: string | null;
    label: string;
}

export async function collectLook(): Promise<LookData | null> {
    const me = UserStore.getCurrentUser();
    if (!me) return null;

    const helpers = (VencordNative as any)?.pluginHelpers;
    const [badgesAll, cosmeticsAll, dekoAll] = await Promise.all([
        VencordNative.kittycordBadges.getBadges().catch(() => []),
        helpers?.KittycordCosmetics?.getCosmetics?.().catch(() => []) ?? [],
        helpers?.KittyDeko?.getDeko?.().catch(() => []) ?? []
    ]);

    const badges: LookBadge[] = (badgesAll as any[])
        .filter(b => b?.id === me.id && b.emoji)
        .sort((a, b) => a.slot - b.slot)
        .map(b => ({ emoji: b.emoji, label: b.label }));
    const cosmetic = (cosmeticsAll as any[]).find(c => c?.id === me.id);
    const dekoId = (dekoAll as any[]).find(d => d?.id === me.id)?.deco as string | undefined;

    if (!badges.length && !cosmetic && !dekoId) return null;

    return {
        displayName: me.globalName || me.username,
        username: me.username,
        avatarUrl: IconUtils.getUserAvatarURL(me, true, 256),
        color1: cosmetic?.color1,
        color2: cosmetic?.color2,
        dekoId,
        badges
    };
}

function nameFill(ctx: CanvasRenderingContext2D, cx: number, textWidth: number, data: LookData): string | CanvasGradient {
    if (data.color1 && data.color2) {
        const g = ctx.createLinearGradient(cx - textWidth / 2, 0, cx + textWidth / 2, 0);
        g.addColorStop(0, data.color1);
        g.addColorStop(1, data.color2);
        return g;
    }
    return data.color1 || COL.white;
}

function chipWidth(ctx: CanvasRenderingContext2D, chip: Chip): number {
    ctx.font = `600 26px ${FONT}`;
    const labelW = ctx.measureText(chip.label).width;
    const hasIcon = Boolean(chip.icon || chip.emoji);
    return 44 + (hasIcon ? 46 : 0) + labelW;
}

function drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, chip: Chip) {
    const w = chipWidth(ctx, chip);
    const midY = y + h / 2;

    ctx.fillStyle = "rgba(255, 138, 196, 0.12)";
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 138, 196, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    let ix = x + 22;
    if (chip.icon) {
        ctx.save();
        roundRectPath(ctx, ix, midY - 17, 34, 34, 8);
        ctx.clip();
        ctx.drawImage(chip.icon, ix, midY - 17, 34, 34);
        ctx.restore();
        ix += 46;
    } else if (chip.emoji) {
        ctx.font = `28px ${FONT}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = COL.white;
        ctx.fillText(chip.emoji, ix, midY + 1);
        ix += 46;
    }

    ctx.font = `600 26px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = COL.white;
    ctx.fillText(chip.label, ix, midY + 1);
    ctx.textBaseline = "alphabetic";
}

function drawChips(ctx: CanvasRenderingContext2D, chips: Chip[], topY: number) {
    const h = 50;
    const gap = 12;
    const maxRowW = WIDTH - 160;
    const measured = chips.map(c => ({ c, w: chipWidth(ctx, c) }));

    const rows: { items: typeof measured; w: number; }[] = [];
    let cur: typeof measured = [];
    const rowWidth = (items: typeof measured) => items.reduce((s, m, i) => s + m.w + (i ? gap : 0), 0);
    for (const m of measured) {
        if (cur.length && rowWidth([...cur, m]) > maxRowW) {
            rows.push({ items: cur, w: rowWidth(cur) });
            cur = [m];
        } else {
            cur.push(m);
        }
    }
    if (cur.length) rows.push({ items: cur, w: rowWidth(cur) });

    let y = topY;
    for (const row of rows.slice(0, 2)) {
        let x = (WIDTH - row.w) / 2;
        for (const m of row.items) {
            drawChip(ctx, x, y, h, m.c);
            x += m.w + gap;
        }
        y += h + 12;
    }
}

export async function renderLookCard(data: LookData): Promise<Blob> {
    if (document.fonts?.ready) await document.fonts.ready;

    const cat = await loadImage(BRAND_ICON);
    const avatar = data.avatarUrl ? await loadImageCors(data.avatarUrl) : null;
    const deko = data.dekoId ? await loadImageCors(assetUrl(data.dekoId)) : null;

    const badgeChips: Chip[] = await Promise.all(data.badges.map(async b => {
        const isImage = /^https:\/\//i.test(b.emoji);
        const icon = await loadImageCors(isImage ? b.emoji : twemojiUrl(b.emoji));
        return {
            icon,
            emoji: icon ? null : b.emoji,
            label: b.label
        };
    }));

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to get 2D rendering context");

    ctx.textBaseline = "alphabetic";
    drawCardBackground(ctx, WIDTH, HEIGHT);

    const cx = WIDTH / 2;
    const avatarSize = 176;
    const avatarCy = 150;
    const avatarTop = avatarCy - avatarSize / 2;

    if (avatar) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, cx - avatarSize / 2, avatarTop, avatarSize, avatarSize);
        ctx.restore();
    } else {
        ctx.save();
        roundRectPath(ctx, cx - avatarSize / 2, avatarTop, avatarSize, avatarSize, 44);
        ctx.clip();
        ctx.drawImage(cat, cx - avatarSize / 2, avatarTop, avatarSize, avatarSize);
        ctx.restore();
    }

    if (deko) {
        const dekoSize = avatarSize * 1.42;
        ctx.drawImage(deko, cx - dekoSize / 2, avatarCy - dekoSize / 2, dekoSize, dekoSize);
    } else {
        ctx.beginPath();
        ctx.arc(cx, avatarCy, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = data.color1 || COL.pinkHi;
        ctx.lineWidth = 5;
        ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.font = `800 72px ${FONT}`;
    const name = truncate(ctx, data.displayName, WIDTH - 200);
    const nameW = ctx.measureText(name).width;
    ctx.fillStyle = nameFill(ctx, cx, nameW, data);
    ctx.fillText(name, cx, 318);

    ctx.font = `400 28px ${FONT}`;
    ctx.fillStyle = COL.faint;
    ctx.fillText(`@${data.username}`, cx, 358);

    const chips: Chip[] = [];
    if (data.dekoId) {
        const label = byId.get(data.dekoId)?.label ?? data.dekoId;
        chips.push({ icon: deko, emoji: null, label });
    }
    chips.push(...badgeChips);
    if (chips.length) drawChips(ctx, chips, 392);

    drawFooterPill(ctx, cx, HEIGHT - 104, "kittycord.dev", cat);

    return canvasToBlob(canvas);
}
