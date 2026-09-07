/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { Forms } from "@webpack/common";

const STYLE_ID = "vc-smoothtype";

const settings = definePluginSettings({
    transitionDelay: {
        type: OptionType.NUMBER,
        description: "Transition Delay (ms)",
        default: 60,
        onChange: () => applyCSS(),
    },
    animationType: {
        type: OptionType.SELECT,
        description: "Animation Type",
        options: [
            { label: "Ease", value: "ease", default: true },
            { label: "Linear", value: "linear" },
            { label: "Ease-in", value: "ease-in" },
            { label: "Ease-out", value: "ease-out" },
            { label: "Ease-in-out", value: "ease-in-out" },
        ],
        onChange: () => applyCSS(),
    },
    caretColor: {
        type: OptionType.COMPONENT,
        description: "Caret color",
        default: 0xffffff,
        component: () => {
            const hex = "#" + ((settings.store.caretColor ?? 0xffffff).toString(16).padStart(6, "0"));
            return (
                <div>
                    <Forms.FormTitle tag="h3">Caret Color</Forms.FormTitle>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                            type="color"
                            value={hex}
                            onChange={e => {
                                const n = parseInt(e.target.value.replace("#", ""), 16);
                                if (!isNaN(n)) { settings.store.caretColor = n; applyCSS(); }
                            }}
                            style={{ width: 40, height: 32, padding: 2, border: "none", borderRadius: 4, cursor: "pointer", background: "none" }}
                        />
                        <input
                            type="text"
                            value={hex}
                            onChange={e => {
                                const h = e.target.value.replace("#", "");
                                const n = parseInt(h, 16);
                                if (!isNaN(n) && h.length === 6) { settings.store.caretColor = n; applyCSS(); }
                            }}
                            style={{ width: 90, padding: "4px 8px", borderRadius: 4, border: "1px solid var(--background-modifier-accent)", background: "var(--background-secondary)", color: "var(--text-normal)", fontSize: 13 }}
                        />
                    </div>
                </div>
            );
        },
    },
});

function toHex(n: number) {
    return `#${n.toString(16).padStart(6, "0")}`;
}

function buildCSS(): string {
    const color = toHex(settings.store.caretColor ?? 0xffffff);
    const ms = settings.store.transitionDelay ?? 60;
    const easing = settings.store.animationType ?? "ease";
    return `
@keyframes vc-blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
}
#vc-smoothtype-caret.is-blinking {
    animation: vc-blink 1s ease-in-out infinite;
}
#vc-smoothtype-caret.is-instant {
    transition: none !important;
}
#vc-smoothtype-caret {
    position: fixed;
    top: 0; left: 0;
    width: 2px;
    border-radius: 2px;
    background: ${color};
    pointer-events: none;
    z-index: 99999;
    display: none;
    transition: left ${ms}ms ${easing}, top ${ms}ms ${easing}, height ${ms}ms ${easing};
}
[data-slate-editor] { caret-color: transparent !important; }
`;
}

// Cached reference to avoid repeated DOM lookups
let caretEl: HTMLDivElement | null = null;

function getCaret(): HTMLDivElement {
    if (caretEl && caretEl.isConnected) return caretEl;
    let el = document.getElementById("vc-smoothtype-caret") as HTMLDivElement | null;
    if (!el) {
        el = document.createElement("div");
        el.id = "vc-smoothtype-caret";
        document.body.appendChild(el);
    }
    caretEl = el;
    return el;
}

function getExistingCaret(): HTMLDivElement | null {
    if (caretEl && caretEl.isConnected) return caretEl;
    caretEl = document.getElementById("vc-smoothtype-caret") as HTMLDivElement | null;
    return caretEl;
}

let blinkTimer: ReturnType<typeof setTimeout> | null = null;
let instantTimer: ReturnType<typeof setTimeout> | null = null;

function startBlink() { getExistingCaret()?.classList.add("is-blinking"); }

function stopBlink() {
    getExistingCaret()?.classList.remove("is-blinking");
    if (blinkTimer) clearTimeout(blinkTimer);
    blinkTimer = setTimeout(startBlink, 1000);
}

function hideCaret() {
    const el = getExistingCaret();
    if (el && el.style.display !== "none") el.style.display = "none";
}

function isSlateEditorActive() {
    return Boolean(document.activeElement?.closest("[data-slate-editor]"));
}

function isSlateEditorEvent(event: Event) {
    return event.target instanceof Element && Boolean(event.target.closest("[data-slate-editor]"));
}

function moveInstantlyForTyping() {
    const el = getExistingCaret();
    if (!el) return;
    el.classList.add("is-instant");
    if (instantTimer) clearTimeout(instantTimer);
    instantTimer = setTimeout(() => {
        instantTimer = null;
        getExistingCaret()?.classList.remove("is-instant");
    }, 90);
}

function applyCaretPosition(instant = false) {
    if (!isSlateEditorActive()) {
        hideCaret(); return;
    }
    const el = getCaret();
    if (instant) moveInstantlyForTyping();
    const sel = window.getSelection();
    if (!sel?.rangeCount) { hideCaret(); return; }
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(false);
    const rects = range.getClientRects();
    let rect: DOMRect | null = rects.length > 0 ? rects[0] : null;

    // Collapsed ranges after deletion often return 0 rects. Use a temporary
    // zero-width space to get the real cursor position instead of falling back
    // to the parent element (which gave the wrong right-edge position).
    if (!rect || rect.height === 0) {
        const marker = document.createTextNode("\u200b");
        range.insertNode(marker);
        const markerRange = document.createRange();
        markerRange.selectNode(marker);
        const markerRects = markerRange.getClientRects();
        if (markerRects.length > 0) rect = markerRects[0];
        // Restore selection and clean up marker
        marker.parentNode?.removeChild(marker);
        // Reinstate the selection so the editor doesn't break
        sel.removeAllRanges();
        const restored = document.createRange();
        restored.setStart(range.startContainer, range.startOffset);
        restored.collapse(true);
        sel.addRange(restored);
    }

    // Final fallback: try the closest Slate leaf span or parent element
    if (!rect || rect.height === 0) {
        const node = range.startContainer;
        const parent = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;
        // Prefer Slate leaf nodes (narrow) over block-level containers
        const leaf = parent?.closest("[data-slate-leaf]") as HTMLElement | null;
        const target = leaf ?? parent;
        if (target) rect = target.getBoundingClientRect();
    }

    if (!rect || rect.height === 0) { hideCaret(); return; }
    // Use rect.left for collapsed cursor position (rect.right == rect.left for
    // zero-width rects, but for the parent fallback left is more correct)
    const newLeft = (rects.length > 0 ? rect.right : rect.left) + "px";
    const newTop = rect.top + "px";
    if (el.style.left !== newLeft || el.style.top !== newTop) {
        if (el.style.display !== "none") stopBlink();
    }
    el.style.display = "block";
    el.style.left = newLeft;
    el.style.top = newTop;
    el.style.height = rect.height + "px";
}

let observerRaf = 0;
let instantUpdate = false;

function scheduleCaretUpdate(instant = false) {
    // Early bail-out before any work if editor is not focused
    if (!isSlateEditorActive()) {
        if (!observerRaf) hideCaret();
        return;
    }
    instantUpdate = instantUpdate || instant;
    if (observerRaf) return;
    // Double-RAF: Slate re-renders the DOM asynchronously after input events.
    // A single RAF can fire before Slate finishes updating, giving us stale
    // rects. The second RAF ensures the DOM is settled.
    observerRaf = requestAnimationFrame(() => {
        observerRaf = requestAnimationFrame(() => {
            observerRaf = 0;
            const shouldMoveInstantly = instantUpdate;
            instantUpdate = false;
            applyCaretPosition(shouldMoveInstantly);
        });
    });
}

const handlers = {
    sel:   () => {
        // Guard: skip entirely if not in a Slate editor — this fires on EVERY
        // selection change in the document (clicking anywhere, highlighting text
        // in messages, etc.) and was the #1 cause of lag.
        if (!isSlateEditorActive()) return;
        scheduleCaretUpdate();
    },
    focus: () => scheduleCaretUpdate(),
    blur:  () => hideCaret(),
    key:   (event: Event) => {
        if (isSlateEditorEvent(event)) scheduleCaretUpdate(true);
    },
    keydown: (event: Event) => {
        // Holding Backspace/Delete can batch input events — listen to keydown
        // as well so the caret tracks every individual deletion frame.
        if (!(event instanceof KeyboardEvent)) return;
        if (event.key === "Backspace" || event.key === "Delete") {
            if (isSlateEditorEvent(event)) scheduleCaretUpdate(true);
        }
    },
    click: (event: Event) => {
        if (isSlateEditorEvent(event)) scheduleCaretUpdate();
    },
};

function startListeners() {
    document.addEventListener("selectionchange", handlers.sel);
    document.addEventListener("focusin", handlers.focus);
    document.addEventListener("focusout", handlers.blur);
    document.addEventListener("input", handlers.key, true);
    document.addEventListener("keydown", handlers.keydown, true);
    document.addEventListener("click", handlers.click, true);
}

function stopListeners() {
    document.removeEventListener("selectionchange", handlers.sel);
    document.removeEventListener("focusin", handlers.focus);
    document.removeEventListener("focusout", handlers.blur);
    document.removeEventListener("input", handlers.key, true);
    document.removeEventListener("keydown", handlers.keydown, true);
    document.removeEventListener("click", handlers.click, true);
}

function applyCSS() {
    document.getElementById(STYLE_ID)?.remove();
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = buildCSS();
    document.head.appendChild(s);
}

function removeCSS() {
    document.getElementById(STYLE_ID)?.remove();
}

export default definePlugin({
    name: "SmoothType",
    enabledByDefault: false,
    description: "The plugin allows you to fully customize the cursor caret's visual settings, including adjustable transition delays and custom CSS animation effects.",
    authors: [{ name: "coll", id: 0n }, { name: "viciouscal", id: 0n }],
    settings,

    start() {
        applyCSS();
        getCaret();
        startListeners();
    },

    stop() {
        stopListeners();
        if (observerRaf) cancelAnimationFrame(observerRaf);
        observerRaf = 0;
        if (instantTimer) clearTimeout(instantTimer);
        instantTimer = null;
        removeCSS();
        if (blinkTimer) clearTimeout(blinkTimer);
        document.getElementById("vc-smoothtype-caret")?.remove();
        caretEl = null;
    },
});
