/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent } from "electron";

/**
 * Sends the message text to Groq's chat-completions endpoint to be spell/grammar-corrected.
 *
 * Runs in the MAIN process on purpose: Discord's renderer CSP blocks fetch() to api.groq.com,
 * so the request has to go through here. The ONLY network request this plugin ever makes is
 * the one below, and only when the renderer passes a non-empty apiKey supplied by the user.
 *
 * On ANY error, non-2xx status, or empty/unusable response, the ORIGINAL text is returned
 * unchanged so a failed correction never alters or drops the user's message.
 */
export async function correct(_: IpcMainInvokeEvent, apiKey: string, systemPrompt: string, text: string): Promise<string> {
    // Defence in depth: never hit the network without a user-supplied key.
    if (!apiKey || !apiKey.trim()) return text;

    try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey.trim()}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                temperature: 0,
                max_tokens: 512,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: text }
                ]
            })
        });

        if (!res.ok) return text;

        const data = await res.json();
        const corrected = data?.choices?.[0]?.message?.content;
        if (typeof corrected !== "string" || corrected.trim() === "") return text;

        return corrected;
    } catch {
        return text;
    }
}

const DEEPL_TARGET: Record<string, string> = { en: "EN-US", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT-PT" };
const DEEPL_SOURCE: Record<string, string> = { en: "EN", de: "DE", fr: "FR", es: "ES", it: "IT", pt: "PT" };

async function deeplTranslate(base: string, apiKey: string, text: string, targetLang: string, sourceLang?: string): Promise<string | null> {
    const body: Record<string, unknown> = { text: [text], target_lang: targetLang };
    if (sourceLang) body.source_lang = sourceLang;

    const res = await fetch(`${base}/v2/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `DeepL-Auth-Key ${apiKey}` },
        body: JSON.stringify(body)
    });
    if (!res.ok) return null;

    const data = await res.json();
    const out = data?.translations?.[0]?.text;
    return typeof out === "string" && out.trim() !== "" ? out : null;
}

/**
 * "Round-trip" cleanup using the DeepL TRANSLATION API (the free tier does translation, not the
 * paid Write/correction). Translates the text to a pivot language and back, which yields
 * grammatical text. NOTE: this REWRITES the message - wording/tone/meaning can change; it is not a
 * faithful spell-checker. Free DeepL keys end in ":fx" (api-free host). Returns the ORIGINAL text
 * on any failure, so a message is never dropped/garbled by a failed request.
 */
export async function deeplRoundtrip(_: IpcMainInvokeEvent, apiKey: string, lang: string, text: string): Promise<string> {
    const key = (apiKey || "").trim();
    if (!key) return text;

    const base = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
    const l = DEEPL_TARGET[lang] ? lang : "en";
    const pivot = l === "en" ? { t: "DE", s: "DE" } : { t: "EN-US", s: "EN" };

    try {
        const mid = await deeplTranslate(base, key, text, pivot.t, DEEPL_SOURCE[l]);
        if (!mid) return text;
        const final = await deeplTranslate(base, key, mid, DEEPL_TARGET[l], pivot.s);
        return final && final.trim() !== "" ? final : text;
    } catch {
        return text;
    }
}
