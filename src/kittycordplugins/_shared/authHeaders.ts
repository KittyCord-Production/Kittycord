/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const AUTH_RE = /^[A-Za-z0-9+/=]{1,512}$/;

export const authHeaders = (auth: unknown): Record<string, string> => ({
    "Content-Type": "application/json",
    ...(typeof auth === "string" && AUTH_RE.test(auth) ? { Authorization: auth } : {})
});
