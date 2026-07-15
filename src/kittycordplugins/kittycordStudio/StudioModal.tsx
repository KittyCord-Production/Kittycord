/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Logger } from "@utils/Logger";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { Alerts, Button, React, showToast, Slider, Text, TextInput, Toasts } from "@webpack/common";
import type { ComponentType } from "react";

import { ShareFileModal } from "../_shared/ShareFileModal";
import { openGallery, openPublish } from "./GalleryModal";
import { buildThemeFile } from "./share";
import { enableTheme, galleryAvailable, getThemes, isThemeEnabled, loadThemes, removeTheme, saveTheme } from "./store";
import { ASSET_ENDPOINT, BG_IDS, BG_URL_RE, bgAssetUrl, defaultParams, derivePalette, FONT_IDS, FONTS, HEX_RE, MAX_BG_URL_LEN, MAX_BLUR, MAX_ROUNDNESS, NAME_RE, PATTERN_IDS, sanitizeParams, type StudioBg, type StudioParams } from "./template";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const logger = new Logger("KittycordStudio");

const PUBLISH_NUDGED_KEY = "Kittycord_StudioPublishNudged";

async function maybeNudgePublish(params: StudioParams, fileName: string) {
    if (!galleryAvailable()) return;
    const nudged = (await get<string[]>(PUBLISH_NUDGED_KEY)) ?? [];
    if (nudged.includes(fileName)) return;
    await set(PUBLISH_NUDGED_KEY, [...nudged, fileName]);
    Alerts.show({
        title: "Share it in the gallery?",
        body: `"${params.name}" is ready. Publishing adds it to the community gallery so other Kittycord users can find and apply your theme.`,
        confirmText: "Publish",
        cancelText: "Not now",
        onConfirm: () => openPublish(params)
    });
}

const COLOR_FIELDS: { key: keyof StudioParams["colors"]; label: string; hint: string; }[] = [
    { key: "bg", label: "Background", hint: "the base of everything" },
    { key: "accent", label: "Accent", hint: "buttons, mentions, highlights" },
    { key: "accentHi", label: "Accent light", hint: "links and bright touches" },
    { key: "accent2", label: "Accent 2", hint: "unread badges and dots" },
    { key: "accent3", label: "Accent 3", hint: "links on hover" },
    { key: "text", label: "Text", hint: "main text color" },
    { key: "muted", label: "Muted", hint: "quiet labels and channels" }
];

const COLOR_FALLBACK: Partial<Record<keyof StudioParams["colors"], keyof StudioParams["colors"]>> = {
    accent2: "accent",
    accent3: "accentHi"
};

function ColorRow({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange(v: string): void; }) {
    const [draft, setDraft] = React.useState(value);

    React.useEffect(() => setDraft(value), [value]);

    function commit(text: string) {
        setDraft(text);
        const hex = text.trim().toLowerCase();
        if (HEX_RE.test(hex)) onChange(hex);
    }

    return (
        <Flex style={{ alignItems: "center", gap: 10, padding: "5px 0" }}>
            <input
                type="color"
                value={value}
                onChange={e => onChange(e.currentTarget.value.toLowerCase())}
                style={{ width: 36, height: 36, border: "none", borderRadius: 8, padding: 0, background: "none", cursor: "pointer" }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
                <Text variant="text-sm/semibold">{label}</Text>
                <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>{hint}</Text>
            </div>
            <div style={{ width: 110 }}>
                <TextInput value={draft} onChange={commit} maxLength={7} />
            </div>
        </Flex>
    );
}

export function PreviewPane({ params }: { params: StudioParams; }) {
    const p = derivePalette(params);
    const r = Math.max(4, params.roundness - 4);
    const a = Math.min(100, Math.max(0, params.opacity)) / 100;
    const surf = (hex: string) => {
        if (a >= 1) return hex;
        const n = hex.replace("#", "");
        return `rgba(${parseInt(n.slice(0, 2), 16)}, ${parseInt(n.slice(2, 4), 16)}, ${parseInt(n.slice(4, 6), 16)}, ${a})`;
    };
    const bgRaw = params.bg.kind === "hosted" ? bgAssetUrl(params.bg.id ?? "") : params.bg.kind === "url" ? (params.bg.url ?? "") : "";
    const bgUrl = bgRaw.startsWith("/") ? ASSET_ENDPOINT + bgRaw : bgRaw;
    const font = params.font && FONTS[params.font] ? FONTS[params.font].stack : undefined;

    return (
        <div style={{ position: "relative", background: p.bg[1], borderRadius: 12, border: `1px solid ${p.line}`, overflow: "hidden", height: 240, fontFamily: font }}>
            {bgUrl && <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${bgUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }} />}
            <div style={{ position: "relative", display: "flex", height: "100%" }}>
                <div style={{ width: 56, background: surf(p.bg[0]), padding: 8, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                    {[p.accent, p.bg[5], p.bg[5]].map((c, i) => (
                        <div key={i} style={{ position: "relative", width: 32, height: 32, borderRadius: i === 0 ? 12 : 16, background: c }}>
                            {i === 2 && <div style={{ position: "absolute", right: -2, bottom: -2, width: 12, height: 12, borderRadius: 999, background: p.accent2, border: `2px solid ${p.bg[0]}` }} />}
                        </div>
                    ))}
                </div>
                <div style={{ width: 110, background: surf(p.bg[2]), padding: "10px 8px" }}>
                    <div style={{ color: p.text, fontWeight: 700, fontSize: 12, marginBottom: 10 }}>cat café 🐱</div>
                    {["general", "kitty-pics", "mod-talk"].map((c, i) => (
                        <div key={c} style={{ color: i === 1 ? p.text : p.muted, background: i === 1 ? `${p.accent}22` : "transparent", borderRadius: 6, fontSize: 11, padding: "4px 6px", marginBottom: 2 }}>
                            # {c}
                        </div>
                    ))}
                </div>
                <div style={{ flex: 1, background: surf(p.bg[3]), display: "flex", flexDirection: "column", padding: 10 }}>
                    <div style={{ flex: 1, fontSize: 11 }}>
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: p.accentHi, fontWeight: 600 }}>mochi</span>
                            <span style={{ color: p.text }}> — check out </span>
                            <span style={{ color: p.accent3 }}>kittycord.dev</span>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                            <span style={{ color: p.blush, fontWeight: 600 }}>luna</span>
                            <span style={{ color: p.text }}> — made it myself in </span>
                            <span style={{ color: p.accentHi, background: `${p.accent}24`, borderRadius: 4, padding: "0 3px" }}>@Kittycord Studio</span>
                        </div>
                        <div style={{ color: p.muted }}>mochi is typing…</div>
                    </div>
                    <div style={{ background: surf(p.bg[4]), border: `1px solid ${p.line}`, borderRadius: r, color: p.muted, fontSize: 11, padding: "7px 10px" }}>
                        Message #kitty-pics
                    </div>
                </div>
            </div>
        </div>
    );
}

function EditorModal({ rootProps, initial, initialFileName, onSaved }: { rootProps: any; initial: StudioParams; initialFileName?: string; onSaved(): void; }) {
    const [params, setParams] = React.useState<StudioParams>(() => {
        try { return sanitizeParams(initial); } catch { return defaultParams(); }
    });
    const [busy, setBusy] = React.useState(false);

    const p = derivePalette(params);
    const nameValid = NAME_RE.test(params.name.trim());
    const bgUrlValid = params.bg.kind !== "url" || (!!params.bg.url && params.bg.url.length <= MAX_BG_URL_LEN && BG_URL_RE.test(params.bg.url));

    function setColor(key: keyof StudioParams["colors"], value: string) {
        setParams(prev => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
    }

    function setBg(bg: StudioBg) {
        setParams(prev => ({ ...prev, bg }));
    }

    async function save() {
        if (!nameValid) return;
        setBusy(true);
        try {
            const cleanParams = { ...params, name: params.name.trim() };
            const fileName = await saveTheme(cleanParams, initialFileName);
            enableTheme(fileName);
            showToast(`"${cleanParams.name}" saved & applied.`, Toasts.Type.SUCCESS);
            onSaved();
            rootProps.onClose();
            void maybeNudgePublish(cleanParams, fileName);
        } catch (e) {
            logger.error("save failed", e);
            showToast(String((e as Error)?.message ?? "Could not save the theme."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Kittycord Studio 🎨</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div style={{ margin: "14px 0" }}>
                    <PreviewPane params={params} />
                </div>

                <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>Theme name</Text>
                <TextInput value={params.name} onChange={(v: string) => setParams(prev => ({ ...prev, name: v }))} maxLength={40} />
                {!nameValid && (
                    <Text variant="text-xs/normal" style={{ opacity: 0.7, marginTop: 4 }}>
                        Use 1–40 letters, numbers, spaces or - ' ! &amp; .
                    </Text>
                )}

                <Text variant="text-sm/semibold" style={{ margin: "14px 0 2px" }}>Colors</Text>
                {COLOR_FIELDS.map(f => {
                    const fallback = COLOR_FALLBACK[f.key];
                    const value = params.colors[f.key] || (fallback && params.colors[fallback]) || "#000000";
                    return <ColorRow key={f.key} label={f.label} hint={f.hint} value={value} onChange={v => setColor(f.key, v)} />;
                })}

                <Text variant="text-sm/semibold" style={{ margin: "14px 0 8px" }}>Roundness</Text>
                <Slider
                    initialValue={params.roundness}
                    minValue={0}
                    maxValue={MAX_ROUNDNESS}
                    markers={[0, 4, 8, 12, 16, 20, 24]}
                    stickToMarkers={false}
                    onValueChange={(v: number) => setParams(prev => ({ ...prev, roundness: Math.round(v) }))}
                    onValueRender={(v: number) => `${Math.round(v)}px`}
                />

                <Text variant="text-sm/semibold" style={{ margin: "16px 0 6px" }}>Background</Text>
                <Flex style={{ gap: 6 }}>
                    {([["none", "None"], ["hosted", "Curated"], ["url", "Custom URL"]] as const).map(([k, label]) => (
                        <Button
                            key={k}
                            size={Button.Sizes.SMALL}
                            color={params.bg.kind === k ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            onClick={() => setBg(k === "hosted" ? { kind: "hosted", id: BG_IDS[0] } : k === "url" ? { kind: "url", url: "" } : { kind: "none" })}
                        >
                            {label}
                        </Button>
                    ))}
                </Flex>
                {params.bg.kind === "hosted" && (
                    <Flex style={{ gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                        {BG_IDS.map(id => (
                            <div
                                key={id}
                                role="button"
                                onClick={() => setBg({ kind: "hosted", id })}
                                style={{ width: 54, height: 38, borderRadius: 8, cursor: "pointer", backgroundImage: `url("${bgAssetUrl(id)}")`, backgroundSize: "cover", backgroundPosition: "center", border: params.bg.id === id ? `2px solid ${p.accent}` : "2px solid var(--background-modifier-accent)" }}
                            />
                        ))}
                    </Flex>
                )}
                {params.bg.kind === "url" && (
                    <div style={{ marginTop: 8 }}>
                        <TextInput value={params.bg.url ?? ""} onChange={(v: string) => setBg({ kind: "url", url: v })} placeholder="https://example.com/wallpaper.png" maxLength={MAX_BG_URL_LEN} />
                        {!bgUrlValid && (params.bg.url ?? "").length > 0 && (
                            <Text variant="text-xs/normal" style={{ opacity: 0.7, marginTop: 4 }}>Use a direct https image link.</Text>
                        )}
                        <Text variant="text-xs/normal" style={{ opacity: 0.6, marginTop: 4 }}>
                            Anyone who applies a shared theme loads this through Kittycord, not your link directly.
                        </Text>
                    </div>
                )}

                <Text variant="text-sm/semibold" style={{ margin: "16px 0 6px" }}>Pattern</Text>
                <Flex style={{ gap: 6, flexWrap: "wrap" }}>
                    <Button size={Button.Sizes.SMALL} color={!params.pattern ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setParams(prev => ({ ...prev, pattern: "" }))}>None</Button>
                    {PATTERN_IDS.map(id => (
                        <Button key={id} size={Button.Sizes.SMALL} color={params.pattern === id ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setParams(prev => ({ ...prev, pattern: id }))}>{id}</Button>
                    ))}
                </Flex>

                <Text variant="text-sm/semibold" style={{ margin: "16px 0 6px" }}>Font</Text>
                <Flex style={{ gap: 6, flexWrap: "wrap" }}>
                    <Button size={Button.Sizes.SMALL} color={!params.font ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setParams(prev => ({ ...prev, font: "" }))}>Default</Button>
                    {FONT_IDS.map(id => (
                        <Button key={id} size={Button.Sizes.SMALL} color={params.font === id ? Button.Colors.BRAND : Button.Colors.PRIMARY} onClick={() => setParams(prev => ({ ...prev, font: id }))}>{FONTS[id].label}</Button>
                    ))}
                </Flex>

                <Text variant="text-sm/semibold" style={{ margin: "16px 0 8px" }}>Surface opacity</Text>
                <Slider
                    initialValue={params.opacity}
                    minValue={0}
                    maxValue={100}
                    markers={[0, 25, 50, 75, 100]}
                    stickToMarkers={false}
                    onValueChange={(v: number) => setParams(prev => ({ ...prev, opacity: Math.round(v) }))}
                    onValueRender={(v: number) => `${Math.round(v)}%`}
                />
                <Text variant="text-xs/normal" style={{ opacity: 0.6, marginTop: 4 }}>
                    100% is fully solid and lightest on your PC. Lower it to let the backdrop and background show through.
                </Text>

                <Text variant="text-sm/semibold" style={{ margin: "16px 0 8px" }}>Backdrop blur</Text>
                <Slider
                    initialValue={params.blur}
                    minValue={0}
                    maxValue={MAX_BLUR}
                    markers={[0, 6, 12, 18, 24]}
                    stickToMarkers={false}
                    onValueChange={(v: number) => setParams(prev => ({ ...prev, blur: Math.round(v) }))}
                    onValueRender={(v: number) => `${Math.round(v)}px`}
                />
                <Text variant="text-xs/normal" style={{ opacity: 0.6, marginTop: 4 }}>
                    Frosts the chat and sidebars. Turns off automatically in Performance Mode.
                </Text>

                <div style={{ marginTop: 14 }}>
                    <FormSwitch
                        title="Sparkle backdrop"
                        description="Paints soft glows, diamonds and sparkles behind everything."
                        value={params.sparkles}
                        onChange={v => setParams(prev => ({ ...prev, sparkles: v }))}
                    />
                </div>

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "8px 0 16px" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} disabled={!nameValid || busy} onClick={save}>Save &amp; apply</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function StudioListModal({ rootProps }: { rootProps: any; }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
        loadThemes().then(() => setReady(true));
    }, []);

    const themes = Object.entries(getThemes());

    function openEditor(initial: StudioParams, fileName?: string) {
        openModal(props => <EditorModal rootProps={props} initial={initial} initialFileName={fileName} onSaved={forceUpdate} />);
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Kittycord Studio 🎨</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/normal" style={{ margin: "12px 0", opacity: 0.8 }}>
                    Build your own Discord theme from a few colors — no CSS needed. Saved themes apply instantly and live in your themes folder.
                </Text>

                {ready && themes.length === 0 && (
                    <Text variant="text-md/normal" style={{ padding: "8px 0" }}>
                        No Studio themes yet — create your first one!
                    </Text>
                )}
                {themes.map(([fileName, params]) => {
                    const p = derivePalette(params);
                    return (
                        <Flex key={fileName} style={{ alignItems: "center", gap: 10, padding: "8px 0" }}>
                            <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${p.line}` }}>
                                {[p.bg[1], p.bg[3], p.accent, p.accentHi, p.text].map((c, i) => (
                                    <div key={i} style={{ width: 14, height: 28, background: c }} />
                                ))}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <Text variant="text-md/semibold">{params.name}</Text>
                                {isThemeEnabled(fileName) && <Text variant="text-xs/normal" style={{ opacity: 0.6 }}>active</Text>}
                            </div>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => { enableTheme(fileName); forceUpdate(); }}>Apply</Button>
                            <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => openEditor(params, fileName)}>Edit</Button>
                            <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => openModal(props => (
                                <ShareFileModal
                                    rootProps={props}
                                    title={`Share "${params.name}"`}
                                    blurb="Friends with Kittycord get a one-tap import card with a live preview. Only the theme's colors and settings are shared."
                                    buildFile={() => buildThemeFile(params)}
                                    defaultNote={`Here's my "${params.name}" theme, made with Kittycord Studio — add it with one tap!`}
                                />
                            ))}>Share</Button>
                            {galleryAvailable() && <Button size={Button.Sizes.SMALL} look={Button.Looks.LINK} onClick={() => openPublish(params)}>Publish</Button>}
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} look={Button.Looks.LINK} onClick={async () => { await removeTheme(fileName); forceUpdate(); }}>Delete</Button>
                        </Flex>
                    );
                })}

                <Flex style={{ margin: "16px 0", gap: 8 }}>
                    <Button color={Button.Colors.BRAND} onClick={() => openEditor(defaultParams())}>+ New theme</Button>
                    {galleryAvailable() && <Button color={Button.Colors.PRIMARY} look={Button.Looks.LINK} onClick={openGallery}>Browse gallery</Button>}
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

export function openStudio() {
    openModal(props => <StudioListModal rootProps={props} />);
}
