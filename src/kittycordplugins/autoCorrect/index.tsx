/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

// Groq's HTTP POST has to run in the main process: Discord's renderer CSP blocks fetch to
// api.groq.com. This is the ONLY external network request the plugin ever makes.
const Native = VencordNative.pluginHelpers.AutoCorrect as PluginNative<typeof import("./native")>;

const logger = new Logger("AutoCorrect");

const settings = definePluginSettings({
    apiKey: {
        type: OptionType.STRING,
        default: "",
        description:
            "Your own free Groq API key (console.groq.com). REQUIRED. " +
            "WARNING: while AutoCorrect is on, the text of each message you send is sent to " +
            "Groq's servers (a third party) to be corrected. Leave empty to send nothing anywhere."
    },
    language: {
        type: OptionType.SELECT,
        description: "Language your messages are written in (used to correct in that language).",
        options: [
            { label: "English", value: "en", default: true },
            { label: "German", value: "de" },
            { label: "French", value: "fr" },
            { label: "Spanish", value: "es" },
            { label: "Italian", value: "it" },
            { label: "Portuguese", value: "pt" }
        ]
    },
    aggressiveness: {
        type: OptionType.SELECT,
        description: "How much AutoCorrect is allowed to change. Your message text is still sent to Groq either way.",
        options: [
            { label: "Low — fix obvious typos only", value: "low", default: true },
            { label: "Medium — typos plus light grammar", value: "medium" },
            { label: "High — full rewrite for clean text", value: "high" }
        ]
    }
});

const LANG_PROMPTS: Record<string, string> = {
    en: "You are a spell-checker. Fix ONLY spelling and grammar mistakes. Return ONLY the corrected text, with no explanation and no quotes. FORBIDDEN: adding words, changing the meaning, or rephrasing. If the text is already correct, return it unchanged.",
    de: "Du bist ein Rechtschreibprüfer. Korrigiere AUSSCHLIESSLICH Rechtschreib- und Grammatikfehler. Gib NUR den korrigierten Text zurück, ohne Erklärung und ohne Anführungszeichen. VERBOTEN: Wörter hinzufügen, die Bedeutung ändern oder umformulieren. Wenn der Text bereits korrekt ist, gib ihn unverändert zurück.",
    fr: "Tu es un correcteur orthographique. Corrige UNIQUEMENT les fautes d'orthographe et de grammaire. Retourne UNIQUEMENT le texte corrigé, sans explication ni guillemets. INTERDIT : ajouter des mots, changer le sens ou reformuler. Si le texte est déjà correct, retourne-le inchangé.",
    es: "Eres un corrector ortográfico. Corrige SOLO errores de ortografía y gramática. Devuelve SOLO el texto corregido, sin explicación ni comillas. PROHIBIDO: añadir palabras, cambiar el significado o reformular. Si el texto ya es correcto, devuélvelo sin cambios.",
    it: "Sei un correttore ortografico. Correggi SOLO errori di ortografia e grammatica. Restituisci SOLO il testo corretto, senza spiegazioni né virgolette. VIETATO: aggiungere parole, cambiare il significato o riformulare. Se il testo è già corretto, restituiscilo invariato.",
    pt: "Você é um corretor ortográfico. Corrija SOMENTE erros de ortografia e gramática. Retorne SOMENTE o texto corrigido, sem explicação e sem aspas. PROIBIDO: adicionar palavras, mudar o sentido ou reformular. Se o texto já estiver correto, retorne-o sem alterações."
};

const AGGR_SUFFIX: Record<string, string> = {
    low: " STRICT: do NOT touch style. Fix only obvious typos and basic grammar. Do NOT change the choice of words. Keep the text as identical as possible. Return ONLY the text.",
    medium: " Fix mistakes and slightly improve clarity where needed, but never change the meaning.",
    high: " Fix everything and rewrite into clean, fluent, well-formed text without changing the meaning."
};

function buildSystemPrompt(): string {
    const lang = settings.store.language ?? "en";
    const aggr = settings.store.aggressiveness ?? "low";
    return (LANG_PROMPTS[lang] ?? LANG_PROMPTS.en) + (AGGR_SUFFIX[aggr] ?? AGGR_SUFFIX.low);
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(w => w.length > 0).length;

async function correctText(text: string): Promise<string> {
    // No key => no network call, ever. This is the hard opt-in gate.
    const apiKey = settings.store.apiKey?.trim();
    if (!apiKey) return text;

    if (text.trim().length < 3) return text;

    let corrected: string;
    try {
        corrected = await Native.correct(apiKey, buildSystemPrompt(), text);
    } catch (e) {
        logger.warn("Correction request failed, keeping original message.", e);
        return text;
    }

    // Strip surrounding quotes the model sometimes wraps the answer in.
    corrected = corrected.replace(/^"(.*)"$/s, "$1").trim();

    // Reject empty, unchanged, or wildly different results — keep the original.
    if (!corrected || corrected === text) return text;
    if (corrected.length > text.length * 1.5 || corrected.length < text.length * 0.4) return text;

    // In low mode, the word count must stay close — a big change means a rewrite, not a typo fix.
    if ((settings.store.aggressiveness ?? "low") === "low") {
        const src = wordCount(text);
        const out = wordCount(corrected);
        if (Math.abs(out - src) > Math.max(1, Math.floor(src * 0.15))) return text;
    }

    return corrected;
}

let listener: MessageSendListener;

export default definePlugin({
    name: "AutoCorrect",
    description: "Opt-in: fixes spelling/grammar of the message you're about to send using the Groq AI API. Off until you paste your own free Groq key (console.groq.com) into its settings. WARNING: while enabled, the text of each message you send is sent to Groq's servers (a third party). No key configured = nothing is ever sent anywhere.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Chat", "Utility"],
    dependencies: ["MessageEventsAPI"],
    settings,

    start() {
        listener = addMessagePreSendListener(async (_channelId, message) => {
            // Re-check the key on every send: still the only thing that allows a network call.
            if (!settings.store.apiKey?.trim()) return;
            if (!message.content) return;
            message.content = await correctText(message.content);
        });
    },

    stop() {
        removeMessagePreSendListener(listener);
    }
});
