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
