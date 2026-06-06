/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { addMessagePreSendListener, MessageSendListener, removeMessagePreSendListener } from "@api/MessageEvents";
import { definePluginSettings, Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, PluginNative } from "@utils/types";
import { React } from "@webpack/common";

import { localCorrect } from "./corrections";

// Groq's HTTP POST has to run in the main process: Discord's renderer CSP blocks fetch to
// api.groq.com. This is the ONLY external network request the plugin ever makes.
// undefined on the web/browser build (no main process) - the online engines then fall back to Local.
const Native = VencordNative.pluginHelpers.AutoCorrect as PluginNative<typeof import("./native")> | undefined;

const logger = new Logger("AutoCorrect");

// Per-session on/off, toggled via the chat-bar button. Starts on when the plugin is enabled.
let active = true;

const settings = definePluginSettings({
    engine: {
        type: OptionType.SELECT,
        description: "Local = offline, fixes common typos + capitalizes sentences, nothing is sent anywhere. AI (Groq) = full grammar + punctuation, sends text to Groq (needs your key). DeepL = re-translates your text DE<->EN to clean it (works with a free DeepL key, but REWRITES the wording).",
        options: [
            { label: "Local (offline, no key, private)", value: "local", default: true },
            { label: "AI via Groq (needs your own key)", value: "ai" },
            { label: "DeepL round-trip (DeepL key; rewrites text)", value: "deepl" }
        ]
    },
    apiKey: {
        type: OptionType.STRING,
        default: "",
        description: "Only used in AI mode. Your own free Groq API key (console.groq.com). WARNING: in AI mode the text of each message you send is sent to Groq's servers (a third party). Leave empty to never send anything."
    },
    deeplKey: {
        type: OptionType.STRING,
        default: "",
        description: "Only used in DeepL mode. Your DeepL API key (free keys end in ':fx', from deepl.com/your-account). If left empty, the DeepL key from the Translate plugin is reused automatically. WARNING: in DeepL mode your message is sent to DeepL and re-translated DE<->EN, which CLEANS but REWRITES it - wording/meaning can change."
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
        description: "Local: Low = typos only; Medium/High also capitalize sentence starts. AI: how much rewriting Groq may do.",
        options: [
            { label: "Low — fix obvious typos only", value: "low" },
            { label: "Medium — typos + capitalization", value: "medium", default: true },
            { label: "High — full rewrite for clean text", value: "high" }
        ]
    }
});

const LANG_PROMPTS: Record<string, string> = {
    en: "You are a spell-checker and punctuation fixer. Fix spelling, grammar, capitalization and punctuation (add commas/periods where they belong). Return ONLY the corrected text, with no explanation and no quotes. Do NOT change the meaning or add new ideas. If already correct, return it unchanged.",
    de: "Du bist ein Rechtschreib- und Zeichensetzungs-Korrektor. Korrigiere Rechtschreibung, Grammatik, Groß-/Kleinschreibung und Zeichensetzung (setze Kommas/Punkte an die richtigen Stellen). Gib NUR den korrigierten Text zurück, ohne Erklärung und ohne Anführungszeichen. Ändere NICHT die Bedeutung und füge keine Inhalte hinzu. Wenn bereits korrekt, gib ihn unverändert zurück.",
    fr: "Tu es un correcteur d'orthographe et de ponctuation. Corrige l'orthographe, la grammaire, les majuscules et la ponctuation (ajoute les virgules/points où il faut). Retourne UNIQUEMENT le texte corrigé, sans explication ni guillemets. Ne change pas le sens et n'ajoute rien. Si déjà correct, retourne-le inchangé.",
    es: "Eres un corrector de ortografía y puntuación. Corrige ortografía, gramática, mayúsculas y puntuación (añade comas/puntos donde correspondan). Devuelve SOLO el texto corregido, sin explicación ni comillas. No cambies el significado ni añadas nada. Si ya es correcto, devuélvelo sin cambios.",
    it: "Sei un correttore di ortografia e punteggiatura. Correggi ortografia, grammatica, maiuscole e punteggiatura (aggiungi virgole/punti dove servono). Restituisci SOLO il testo corretto, senza spiegazioni né virgolette. Non cambiare il significato né aggiungere nulla. Se già corretto, restituiscilo invariato.",
    pt: "Você é um corretor de ortografia e pontuação. Corrija ortografia, gramática, maiúsculas e pontuação (adicione vírgulas/pontos onde for preciso). Retorne SOMENTE o texto corrigido, sem explicação e sem aspas. Não mude o sentido nem adicione nada. Se já estiver correto, retorne-o sem alterações."
};

const AGGR_SUFFIX: Record<string, string> = {
    low: " STRICT: fix only clear spelling/grammar/punctuation mistakes. Keep the wording as identical as possible. Return ONLY the text.",
    medium: " Fix mistakes and punctuation and slightly improve clarity where needed, but never change the meaning.",
    high: " Fix everything and rewrite into clean, fluent, well-punctuated text without changing the meaning."
};

function buildSystemPrompt(): string {
    const lang = settings.store.language ?? "en";
    const aggr = settings.store.aggressiveness ?? "low";
    return (LANG_PROMPTS[lang] ?? LANG_PROMPTS.en) + (AGGR_SUFFIX[aggr] ?? AGGR_SUFFIX.low);
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(w => w.length > 0).length;

async function aiCorrect(text: string, apiKey: string): Promise<string> {
    if (text.trim().length < 3) return text;

    let corrected: string;
    try {
        corrected = await Native!.correct(apiKey, buildSystemPrompt(), text);
    } catch (e) {
        logger.warn("Correction request failed, keeping original message.", e);
        return text;
    }

    // Strip surrounding quotes the model sometimes wraps the answer in.
    corrected = corrected.replace(/^"(.*)"$/s, "$1").trim();

    // Reject empty, unchanged, or wildly different results — keep the original.
    if (!corrected || corrected === text) return text;
    if (corrected.length > text.length * 1.6 || corrected.length < text.length * 0.4) return text;

    return corrected;
}

let nativeWarned = false;
function warnNoNative(engineName: string) {
    if (nativeWarned) return;
    nativeWarned = true;
    logger.warn(`${engineName} mode needs the Kittycord desktop app (and a full restart after updating); it can't run on the web/browser build. Using the offline Local engine instead.`);
}

async function correctText(text: string): Promise<string> {
    const lang = settings.store.language ?? "en";
    const engine = settings.store.engine ?? "local";

    // AI (Groq) — only when selected, a key is set, AND the native module is available.
    if (engine === "ai") {
        const apiKey = settings.store.apiKey?.trim();
        if (apiKey) {
            if (Native?.correct) return aiCorrect(text, apiKey);
            warnNoNative("AI");
        }
    } else if (engine === "deepl") {
        // Reuse the Translate plugin's DeepL key so it doesn't have to be entered twice.
        const deeplKey = settings.store.deeplKey?.trim()
            || (Settings.plugins?.Translate?.deeplApiKey as string | undefined)?.trim();
        if (deeplKey && text.trim().length >= 3) {
            if (Native?.deeplRoundtrip) {
                try {
                    return await Native.deeplRoundtrip(deeplKey, lang, text);
                } catch (e) {
                    logger.warn("DeepL correction failed — keeping original message.", e);
                    return text;
                }
            }
            warnNoNative("DeepL");
        }
    }

    // Local (default + fallback): offline, nothing leaves the machine.
    const capitalize = (settings.store.aggressiveness ?? "low") !== "low";
    return localCorrect(text, lang, capitalize);
}

function AutoCorrectIcon({ enabled = true, width = 20, height = 20 }: { enabled?: boolean; width?: string | number; height?: string | number; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                fill="currentColor"
                opacity={enabled ? 1 : 0.35}
                d="M8.87 2.31A.5.5 0 0 1 9.34 2h10.92c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31h-4.28l-4.17 15h4.05c.36 0 .6.36.47.69l-.6 1.5a.5.5 0 0 1-.47.31H3.74a.5.5 0 0 1-.47-.69l.6-1.5a.5.5 0 0 1 .47-.31h4.28l4.17-15H8.74a.5.5 0 0 1-.47-.69l.6-1.5Z"
            />
            {!enabled && <path fill="var(--status-danger)" d="M21.178 1.707 22.592 3.12 4.12 21.593l-1.414-1.415L21.178 1.707Z" />}
        </svg>
    );
}

const AutoCorrectChatBarButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={active ? "AutoCorrect: ON — click to pause" : "AutoCorrect: OFF — click to enable"}
            onClick={() => { active = !active; forceUpdate(); }}
        >
            <AutoCorrectIcon enabled={active} />
        </ChatBarButton>
    );
};

let listener: MessageSendListener;

export default definePlugin({
    name: "AutoCorrect",
    description: "Fixes the message you're about to send. Local (default) is offline & private: fixes common typos and capitalizes sentences - no key, nothing sent. AI mode does full grammar + punctuation (commas etc.) via Groq, but needs your own free key and sends your message text to Groq. Toggle it from the button in the chat bar.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Chat", "Utility"],
    dependencies: ["MessageEventsAPI", "ChatInputButtonAPI"],
    settings,

    chatBarButton: {
        icon: AutoCorrectIcon,
        render: AutoCorrectChatBarButton
    },

    start() {
        active = true;
        listener = addMessagePreSendListener(async (_channelId, message) => {
            if (!active || !message.content) return;
            message.content = await correctText(message.content);
        });
    },

    stop() {
        removeMessagePreSendListener(listener);
    }
});
