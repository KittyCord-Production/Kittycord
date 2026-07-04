/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const isSuspended = () =>
    document.hidden || document.documentElement.matches(".kc-perf-noanim, .kc-idle");

export function watchSuspend(onChange: (suspended: boolean) => void): () => void {
    let last: boolean | null = null;
    const check = () => {
        const now = isSuspended();
        if (now === last) return;
        last = now;
        onChange(now);
    };
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", check);
    check();
    return () => {
        observer.disconnect();
        document.removeEventListener("visibilitychange", check);
    };
}
