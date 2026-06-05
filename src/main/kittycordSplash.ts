/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Rebrands Discord's loading experience to Kittycord:
//  - the small startup splash/update window, and
//  - the main client loading screen (the "Did you know..." tips screen).
// Both are covered with a Kittycord overlay that removes itself once Discord is ready. The DOM is
// version-specific, so this is best-effort and is wrapped so it can never block Discord startup.

import { app } from "electron";

import { KITTY_ICON_DATA_URL } from "./iconData";

// The Kittycord logo as an <img> (the real app icon, embedded as a data URL).
const KITTY_SVG = '<img src="' + KITTY_ICON_DATA_URL + '" width="104" height="104" style="display:block;border-radius:22px" alt="Kittycord">';

// Overlay for the small startup splash/update window: stays until the window closes.
const SPLASH_JS = `
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

// Overlay for the MAIN client loading screen: covers Discord's "Did you know" screen, then fades
// out once the app UI (server list / app chrome) appears, or after a hard timeout as a safety net.
const LOADING_JS = `
(function () {
    try {
        if (window.__kcLoader) return;
        window.__kcLoader = true;
        var css = document.createElement("style");
        css.textContent =
            "#kc-loading{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:#1a0f16;z-index:2147483647;font-family:'gg sans','Segoe UI',sans-serif;transition:opacity .45s ease}" +
            "#kc-loading .kc-logo{animation:kcpulse 1.6s ease-in-out infinite}" +
            "#kc-loading .kc-name{color:#ff5fa6;font-size:34px;font-weight:800;letter-spacing:.5px}" +
            "#kc-loading .kc-tip{color:#e2a9cb;font-size:13px;opacity:.8}" +
            "#kc-loading .kc-bar{width:160px;height:4px;border-radius:4px;background:#3a2230;overflow:hidden;position:relative}" +
            "#kc-loading .kc-bar::after{content:'';position:absolute;left:-40%;top:0;height:100%;width:40%;border-radius:4px;background:#ff5fa6;animation:kcslide 1.1s ease-in-out infinite}" +
            "@keyframes kcpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}" +
            "@keyframes kcslide{0%{left:-40%}100%{left:100%}}";
        (document.head || document.documentElement).appendChild(css);

        var o = document.createElement("div");
        o.id = "kc-loading";
        o.innerHTML = '<div class="kc-logo">${KITTY_SVG}</div>' +
            '<div class="kc-name">Kittycord</div>' +
            '<div class="kc-bar"></div>' +
            '<div class="kc-tip">starting up...</div>';

        function mount() {
            if (document.body && !document.getElementById("kc-loading")) document.body.appendChild(o);
        }
        if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

        var start = Date.now();
        var iv = setInterval(function () {
            var ready =
                document.querySelector('[class*="guilds_"]') ||
                document.querySelector('[class*="base_"]') ||
                document.querySelector('[class*="sidebar_"]');
            if (ready || (Date.now() - start) > 25000) {
                clearInterval(iv);
                var el = document.getElementById("kc-loading");
                if (el) { el.style.opacity = "0"; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500); }
            }
        }, 200);
    } catch (e) {}
})();`;

app.on("browser-window-created", (_, win) => {
    try {
        win.webContents.on("dom-ready", () => {
            try {
                const url = win.webContents.getURL() || "";
                if (/splash/i.test(url)) {
                    win.webContents.executeJavaScript(SPLASH_JS).catch(() => { });
                } else if (/discord\.com/i.test(url) && !/\/popout|\/overlay/i.test(url)) {
                    win.webContents.executeJavaScript(LOADING_JS).catch(() => { });
                }
            } catch { }
        });
    } catch { }
});
