/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const STEP_SEPARATOR = /^\s*---\s*$/;

export interface ExpandContext {
    args: string;
    channelId: string;
    channelMention: string;
    guildName: string;
    selfId: string;
    replyAuthor: string;
    replyText: string;
    clipboard: string;
    useCount: number;
    now: Date;
    random(): number;
}

export interface Placeholder {
    token: string;
    label: string;
}

export const PLACEHOLDERS: Placeholder[] = [
    { token: "{args}", label: "Everything you type after the trigger" },
    { token: "{1}", label: "The first word after the trigger" },
    { token: "{2}", label: "The second word, and so on up to {9}" },
    { token: "{1|there}", label: "The first word, or \"there\" if you typed nothing" },
    { token: "{mentions}", label: "Turns every Discord ID you typed into a ping" },
    { token: "{me}", label: "Pings you" },
    { token: "{channel}", label: "The channel you are in" },
    { token: "{server}", label: "The server you are in" },
    { token: "{reply.author}", label: "The person you are replying to" },
    { token: "{reply.text}", label: "What they said" },
    { token: "{date}", label: "Today's date" },
    { token: "{time}", label: "The time right now" },
    { token: "{weekday}", label: "Today's weekday" },
    { token: "{random:a|b|c}", label: "Picks one of the options at random" },
    { token: "{roll:d20}", label: "Rolls a die, for example 2d6" },
    { token: "{clipboard}", label: "Whatever you last copied" },
    { token: "{count}", label: "How often you have used this command" }
];

const TOKEN_RE = /\{([a-z0-9_.]+)(?:[|:]([^{}]*))?\}/gi;

function words(args: string): string[] {
    const trimmed = args.trim();
    return trimmed ? trimmed.split(/\s+/) : [];
}

function roll(spec: string, random: () => number): string {
    const match = /^(\d*)d(\d+)$/i.exec(spec.trim());
    if (!match) return "";

    const count = Math.min(20, Math.max(1, Number(match[1] || 1)));
    const sides = Math.min(1000, Math.max(2, Number(match[2])));

    let total = 0;
    for (let i = 0; i < count; i++) total += Math.floor(random() * sides) + 1;
    return String(total);
}

export function splitSteps(template: string): string[] {
    const steps: string[] = [];
    let buffer: string[] = [];

    for (const line of template.split("\n")) {
        if (STEP_SEPARATOR.test(line)) {
            steps.push(buffer.join("\n").trim());
            buffer = [];
        } else {
            buffer.push(line);
        }
    }
    steps.push(buffer.join("\n").trim());

    return steps.filter(Boolean);
}

export function usesArgs(template: string): boolean {
    return /\{(args|mentions|[1-9])(?:[|:][^{}]*)?\}/i.test(template);
}

export function expand(template: string, ctx: ExpandContext): string {
    const positional = words(ctx.args);

    const out = template.replaceAll("\\n", "\n").replace(TOKEN_RE, (whole, rawKey: string, param?: string) => {
        const key = rawKey.toLowerCase();

        if (/^[1-9]$/.test(key)) return positional[Number(key) - 1] ?? param ?? "";

        switch (key) {
            case "args": return ctx.args;
            case "mentions": return (ctx.args.match(/\d{17,20}/g) ?? []).map(id => `<@${id}>`).join(" ");
            case "me": return `<@${ctx.selfId}>`;
            case "channel": return ctx.channelMention;
            case "server": return ctx.guildName;
            case "reply.author": return ctx.replyAuthor;
            case "reply.text": return ctx.replyText;
            case "date": return ctx.now.toLocaleDateString();
            case "time": return ctx.now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            case "weekday": return ctx.now.toLocaleDateString([], { weekday: "long" });
            case "clipboard": return ctx.clipboard;
            case "count": return String(ctx.useCount);
            case "random": {
                const options = (param ?? "").split("|").filter(Boolean);
                return options.length ? options[Math.floor(ctx.random() * options.length)] : "";
            }
            case "roll": return roll(param ?? "", ctx.random);
            default: return whole;
        }
    });

    if (!usesArgs(template) && ctx.args) return `${out} ${ctx.args}`.trim();

    return out.trim();
}
