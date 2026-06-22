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

// The Kittycord logo as an <img> filling its rounded container (the real app icon as a data URL).
const KITTY_IMG = '<img src="' + KITTY_ICON_DATA_URL + '" alt="Kittycord" style="width:100%;height:100%;display:block">';

// Shared dark background: a soft radial gradient for depth instead of a flat fill.
const KITTY_BG = "radial-gradient(130% 90% at 50% 32%, #1e1019 0%, #120a10 52%, #0a0608 100%)";

// Shared animation keyframes used by both overlays.
const KITTY_KEYFRAMES =
    "@keyframes kc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}" +
    "@keyframes kc-breathe{0%,100%{transform:scale(.92);opacity:.7}50%{transform:scale(1.05);opacity:1}}" +
    "@keyframes kc-comet{0%{left:-35%}100%{left:100%}}" +
    "@keyframes kc-bounce{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-5px);opacity:1}}" +
    "@keyframes kc-in{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}";

// Overlay for the small startup splash/update window: stays until the window closes.
const SPLASH_JS = `
(function () {
    try {
        if (window.__OVERLAY__) return;
        if (document.getElementById("kc-splash")) return;
        var css = document.createElement("style");
        css.textContent =
            "html,body{margin:0;overflow:hidden;background:#0a0608 !important}" +
            "#kc-splash{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;background:${KITTY_BG};z-index:2147483647;font-family:'gg sans','Segoe UI',sans-serif;-webkit-app-region:drag;animation:kc-in .5s ease both}" +
            "#kc-splash .kc-stage{position:relative;width:104px;height:104px;display:flex;align-items:center;justify-content:center}" +
            "#kc-splash .kc-halo{position:absolute;width:170px;height:170px;border-radius:50%;background:radial-gradient(circle, rgba(255,95,166,.30) 0%, rgba(255,95,166,.09) 42%, transparent 70%);filter:blur(6px);animation:kc-breathe 3.4s ease-in-out infinite}" +
            "#kc-splash .kc-logo{position:relative;width:88px;height:88px;border-radius:22px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04);animation:kc-float 3.4s ease-in-out infinite}" +
            "#kc-splash .kc-name{color:#ff6fb0;font-size:25px;font-weight:800;letter-spacing:.4px;text-shadow:0 2px 16px rgba(255,95,166,.35)}" +
            "#kc-splash .kc-dots{display:flex;gap:6px;margin-top:2px}" +
            "#kc-splash .kc-dots i{width:6px;height:6px;border-radius:50%;background:#ff6fb0;animation:kc-bounce 1s ease-in-out infinite}" +
            "#kc-splash .kc-dots i:nth-child(2){animation-delay:.15s}#kc-splash .kc-dots i:nth-child(3){animation-delay:.3s}" +
            "${KITTY_KEYFRAMES}";
        (document.head || document.documentElement).appendChild(css);
        var o = document.createElement("div");
        o.id = "kc-splash";
        o.innerHTML = '<div class="kc-stage"><div class="kc-halo"></div><div class="kc-logo">${KITTY_IMG}</div></div>' +
            '<div class="kc-name">Kittycord</div>' +
            '<div class="kc-dots"><i></i><i></i><i></i></div>';
        document.body.appendChild(o);
    } catch (e) {}
})();`;

// Overlay for the MAIN client loading screen: covers Discord's "Did you know" screen, then fades
// out once the app UI (server list / app chrome) appears, or after a short timeout as a safety net.
// It never covers Discord's login/auth screens and never blocks input, so it can't trap the user.
const LOADING_JS = `
(function () {
    try {
        // Never mount the loading backdrop in Discord's in-game overlay renderer, or it turns the
        // transparent always-on-top overlay opaque and covers the game. Mirror Discord's own check:
        // the __OVERLAY__ global, the sentinel node, or "overlay" anywhere in the renderer URL/path
        // (the renderer loads from .../discord_overlay[2]/..., so match the substring, not "/overlay").
        if (window.__OVERLAY__ || document.getElementById("__OVERLAY__SENTINEL__") || /overlay/i.test(location.href || "")) return;
        if (window.__kcLoader) return;
        window.__kcLoader = true;

        function isAuthRoute() {
            var p = (location.pathname || "").split("/")[1] || "";
            return p === "login" || p === "register" || p === "verify" || p === "reset" || p === "handoff" || p === "oauth2" || p === "authorize";
        }
        if (isAuthRoute()) return;

        var css = document.createElement("style");
        css.textContent =
            "#kc-loading{position:fixed;inset:0;pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:${KITTY_BG};z-index:2147483647;font-family:'gg sans','Segoe UI',sans-serif;transition:opacity .45s ease;animation:kc-in .5s ease both}" +
            "#kc-loading .kc-stage{position:relative;width:128px;height:128px;display:flex;align-items:center;justify-content:center}" +
            "#kc-loading .kc-halo{position:absolute;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle, rgba(255,95,166,.32) 0%, rgba(255,95,166,.10) 42%, transparent 70%);filter:blur(7px);animation:kc-breathe 3.4s ease-in-out infinite}" +
            "#kc-loading .kc-logo{position:relative;width:104px;height:104px;border-radius:24px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.04);animation:kc-float 3.4s ease-in-out infinite}" +
            "#kc-loading .kc-name{color:#ff6fb0;font-size:31px;font-weight:800;letter-spacing:.4px;text-shadow:0 2px 18px rgba(255,95,166,.35)}" +
            "#kc-loading .kc-bar{width:188px;height:3px;border-radius:99px;background:rgba(255,255,255,.07);overflow:hidden;position:relative}" +
            "#kc-loading .kc-bar span{position:absolute;top:0;left:-35%;height:100%;width:35%;border-radius:99px;background:linear-gradient(90deg,transparent,#ff6fb0 50%,transparent);box-shadow:0 0 12px rgba(255,95,166,.6);animation:kc-comet 1.25s ease-in-out infinite}" +
            "#kc-loading .kc-tip{color:#caa6bb;font-size:12.5px;letter-spacing:.3px;opacity:.85;min-height:16px;transition:opacity .35s ease}" +
            "${KITTY_KEYFRAMES}";
        (document.head || document.documentElement).appendChild(css);

        var o = document.createElement("div");
        o.id = "kc-loading";
        o.innerHTML = '<div class="kc-stage"><div class="kc-halo"></div><div class="kc-logo">${KITTY_IMG}</div></div>' +
            '<div class="kc-name">Kittycord</div>' +
            '<div class="kc-bar"><span></span></div>' +
            '<div class="kc-tip">Warming up the cat…</div>';

        function mount() {
            if (document.body && !document.getElementById("kc-loading")) document.body.appendChild(o);
        }
        if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

        var tips = [
            "Warming up the cat…",
            "Untangling the yarn…",
            "Fluffing the cushions…",
            "Chasing the laser pointer…",
            "Pouncing into Discord…",
            "Sharpening the claws…"
        ];
        var ti = 0;
        var tipIv = setInterval(function () {
            var tip = document.querySelector("#kc-loading .kc-tip");
            if (!tip) return;
            ti = (ti + 1) % tips.length;
            tip.style.opacity = "0";
            setTimeout(function () { tip.textContent = tips[ti]; tip.style.opacity = ".85"; }, 350);
        }, 2600);

        function appReady() {
            return document.querySelector('[class*="guilds_"]') ||
                document.querySelector('[class*="base_"]') ||
                document.querySelector('[class*="sidebar_"]') ||
                document.querySelector('[class*="chat_"]') ||
                document.querySelector('[class*="channels_"]');
        }
        function authVisible() {
            return document.querySelector('input[type="password"]') ||
                document.querySelector('input[name="email"]') ||
                document.querySelector('[class*="authBox"]') ||
                document.querySelector('[class*="qrCode"]');
        }
        function done() {
            clearInterval(iv);
            clearInterval(tipIv);
            var el = document.getElementById("kc-loading");
            if (el) { el.style.opacity = "0"; setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 500); }
        }

        var start = Date.now();
        var iv = setInterval(function () {
            if (window.__OVERLAY__ || appReady() || authVisible() || isAuthRoute() || (Date.now() - start) > 8000) done();
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
