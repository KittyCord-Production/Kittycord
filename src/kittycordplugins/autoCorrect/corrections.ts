/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Offline correction (no network, no key): a curated map of common misspellings per language,
// plus safe sentence-start capitalization. It ONLY fixes clear, unambiguous typos (whole-word,
// case-preserving) and capitalization - it never guesses, never inserts commas/periods, and never
// changes valid words. Full punctuation + grammar is the AI engine's job (it understands context).

const COMMON_TYPOS: Record<string, Record<string, string>> = {
    en: {
        teh: "the", thsi: "this", taht: "that", adn: "and", ot: "to", yuo: "you",
        recieve: "receive", recieved: "received", seperate: "separate", seperated: "separated",
        definately: "definitely", definatly: "definitely", occured: "occurred", occuring: "occurring",
        untill: "until", wich: "which", becuase: "because", becasue: "because", alot: "a lot",
        thier: "their", freind: "friend", freinds: "friends", beleive: "believe", beleived: "believed",
        wierd: "weird", accross: "across", agressive: "aggressive", apparant: "apparent",
        arguement: "argument", calender: "calendar", comming: "coming", commited: "committed",
        concious: "conscious", dissapoint: "disappoint", embarass: "embarrass", enviroment: "environment",
        existance: "existence", familar: "familiar", finaly: "finally", foriegn: "foreign",
        gaurd: "guard", goverment: "government", grammer: "grammar", happend: "happened",
        harrass: "harass", immediatly: "immediately", independant: "independent", knowlege: "knowledge",
        libary: "library", maintainance: "maintenance", neccessary: "necessary", occassion: "occasion",
        occurence: "occurrence", persistant: "persistent", posession: "possession", prefered: "preferred",
        priviledge: "privilege", probaly: "probably", pronounciation: "pronunciation", publically: "publicly",
        recomend: "recommend", recomended: "recommended", refered: "referred", relevent: "relevant",
        religous: "religious", remeber: "remember", resturant: "restaurant", rythm: "rhythm",
        sucessful: "successful", suprise: "surprise", suprised: "surprised", tommorow: "tomorrow",
        tomorow: "tomorrow", truely: "truly", unfortunatly: "unfortunately", usualy: "usually",
        vaccum: "vacuum", youre: "you're", theyre: "they're", dont: "don't", cant: "can't",
        didnt: "didn't", doesnt: "doesn't", isnt: "isn't", wasnt: "wasn't", couldnt: "couldn't",
        shouldnt: "shouldn't", wouldnt: "wouldn't", havent: "haven't", hasnt: "hasn't",
        arent: "aren't", werent: "weren't", im: "I'm", ive: "I've", thats: "that's",
        whats: "what's", theres: "there's"
    },
    de: {
        richti: "richtig", ricthig: "richtig", richtsig: "richtig",
        wirklcih: "wirklich", wircklich: "wirklich",
        natürlcih: "natürlich", natülich: "natürlich",
        zusamen: "zusammen", komen: "kommen", imer: "immer",
        bischen: "bisschen", bisl: "bissl",
        vileicht: "vielleicht", villeicht: "vielleicht", villeich: "vielleicht",
        eigendlich: "eigentlich", ungefehr: "ungefähr", zimlich: "ziemlich",
        trozdem: "trotzdem", jetz: "jetzt", jezt: "jetzt",
        hofentlich: "hoffentlich", wiso: "wieso", gennant: "genannt",
        bekommem: "bekommen", kanst: "kannst", garantirt: "garantiert",
        seperat: "separat", standart: "Standard", warscheinlich: "wahrscheinlich",
        wahrscheindlich: "wahrscheinlich", intressant: "interessant", interesant: "interessant",
        nähmlich: "nämlich", rythmus: "Rhythmus", addresse: "Adresse", agressiv: "aggressiv",
        garnicht: "gar nicht", garnichts: "gar nichts", garkein: "gar kein",
        zumindestens: "zumindest", wiederspiegeln: "widerspiegeln", aufjedenfall: "auf jeden Fall",
        standartmäßig: "standardmäßig", einzigste: "einzige", entschuldung: "Entschuldigung",
        tatsächlig: "tatsächlich", debugen: "debuggen", schliesslich: "schließlich"
    },
    fr: {
        parceque: "parce que", quelquechose: "quelque chose", aujourdhui: "aujourd'hui",
        biensur: "bien sûr", developpement: "développement", deja: "déjà", etre: "être",
        probleme: "problème"
    },
    es: {
        tambien: "también", porfavor: "por favor", aproposito: "a propósito",
        deberia: "debería", habia: "había", asi: "así", ablar: "hablar", aora: "ahora"
    },
    it: {
        perchè: "perché", perche: "perché", piu: "più", cosi: "così",
        sopratutto: "soprattutto", propio: "proprio"
    },
    pt: {
        concerteza: "com certeza", derrepente: "de repente", apartir: "a partir",
        voce: "você", nao: "não", tambem: "também", entao: "então"
    }
};

const regexCache: Record<string, RegExp> = {};

function buildRegex(lang: string, map: Record<string, string>): RegExp {
    if (regexCache[lang]) return regexCache[lang];
    const keys = Object.keys(map)
        .sort((a, b) => b.length - a.length)
        .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`\\b(${keys.join("|")})\\b`, "gi");
    regexCache[lang] = re;
    return re;
}

function applyCase(original: string, replacement: string): string {
    if (original.length > 1 && original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
    return replacement;
}

// Capitalize the first letter of the message and the first letter after sentence-ending
// punctuation. Only touches a lowercase letter right after start / ". " / "! " / "? " — never
// inserts punctuation, never changes anything else.
function capitalizeSentences(text: string): string {
    return text.replace(/(^\s*|[.!?]\s+)([a-zäöüà-ÿ])/g, (_m, pre, ch) => pre + ch.toUpperCase());
}

/**
 * Offline typo + capitalization correction.
 * @param text the message text
 * @param lang language code (en/de/fr/es/it/pt)
 * @param capitalize also capitalize sentence beginnings (tied to aggressiveness >= medium)
 */
export function localCorrect(text: string, lang: string, capitalize: boolean): string {
    const map = COMMON_TYPOS[lang];

    let out = text;
    if (map) {
        out = out.replace(buildRegex(lang, map), match => {
            const fix = map[match.toLowerCase()];
            return fix ? applyCase(match, fix) : match;
        });
        // English: a lone lowercase "i" is virtually always "I".
        if (lang === "en") out = out.replace(/\bi\b/g, "I");
    }

    if (capitalize) out = capitalizeSentences(out);

    return out;
}
