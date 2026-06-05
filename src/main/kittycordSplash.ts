/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Rebrands Discord's startup splash window (the small "updating" window shown before the main
// client) to Kittycord. The splash DOM is version-specific and mangled, so instead of editing it
// we drop a full-cover Kittycord overlay on top. Wrapped so it can never break Discord startup.

import { app } from "electron";

const KITTY_SVG = `
<svg width="92" height="92" viewBox="0 0 512 512">
  <rect x="0" y="0" width="512" height="512" rx="116" fill="#ff8ac4"/>
  <path d="M150 196 L150 92 L244 168 Z" fill="#fff" stroke="#3a2230" stroke-width="10" stroke-linejoin="round"/>
  <path d="M362 196 L362 92 L268 168 Z" fill="#fff" stroke="#3a2230" stroke-width="10" stroke-linejoin="round"/>
  <ellipse cx="256" cy="280" rx="158" ry="138" fill="#fff" stroke="#3a2230" stroke-width="10"/>
  <ellipse cx="200" cy="278" rx="17" ry="24" fill="#3a2230"/>
  <ellipse cx="312" cy="278" rx="17" ry="24" fill="#3a2230"/>
  <ellipse cx="256" cy="304" rx="11" ry="8" fill="#ffcf3f"/>
  <g stroke="#3a2230" stroke-width="8" stroke-linecap="round">
    <path d="M126 290 L74 276"/><path d="M126 310 L76 330"/>
    <path d="M386 290 L438 276"/><path d="M386 310 L436 330"/>
  </g>
  <g transform="translate(330 150)">
    <path d="M0 0 C-46 -34 -86 -30 -86 6 C-86 42 -46 44 0 12 Z" fill="#ff5fa2" stroke="#c61f63" stroke-width="8" stroke-linejoin="round"/>
    <path d="M0 0 C46 -34 86 -30 86 6 C86 42 46 44 0 12 Z" fill="#ff5fa2" stroke="#c61f63" stroke-width="8" stroke-linejoin="round"/>
    <circle cx="0" cy="6" r="17" fill="#ff7ab0" stroke="#c61f63" stroke-width="8"/>
  </g>
</svg>`.replace(/\s+/g, " ");

const OVERLAY_JS = `
(function () {
    try {
        if (document.getElementById("kc-splash")) return;
        var s = document.createElement("style");
        s.textContent = "html,body{margin:0;overflow:hidden;background:#1a0f16 !important}";
        (document.head || document.documentElement).appendChild(s);
        var o = document.createElement("div");
        o.id = "kc-splash";
        o.style.cssText = "position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#1a0f16;z-index:2147483647;font-family:'gg sans','Segoe UI',sans-serif;-webkit-app-region:drag";
        o.innerHTML = '${KITTY_SVG}' +
            '<div style="color:#ff5fa6;font-size:30px;font-weight:800;letter-spacing:.5px">Kittycord</div>' +
            '<div style="color:#e2a9cb;font-size:13px;opacity:.85">loading...</div>';
        document.body.appendChild(o);
    } catch (e) {}
})();`;

app.on("browser-window-created", (_, win) => {
    try {
        win.webContents.on("dom-ready", () => {
            try {
                const url = win.webContents.getURL();
                // Discord's splash window loads a URL containing "splash". Ignore the main client.
                if (!url || !/splash/i.test(url)) return;
                win.webContents.executeJavaScript(OVERLAY_JS).catch(() => { });
            } catch { }
        });
    } catch { }
});
