/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import assert from "node:assert/strict";

import { parseBadgeLink } from "./badgeLink";

const ok = ["https://example.com", "https://twitch.tv/someone?x=1#y", "HTTPS://Example.COM/a b", "https://münchen.de"];
const bad = [
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,hi",
    "//example.com",
    "example.com",
    "https://google.com@evil.com",
    "https://user:pw@example.com",
    "https://localhost",
    "https://127.0.0.1",
    "https://0x7f.1",
    "https://2130706433",
    "https://[::1]",
    "https://[::ffff:1.2.3.4]",
    "https://example.com/" + "a".repeat(300),
    "",
    42,
    null
];

for (const v of ok) assert.ok(parseBadgeLink(v), `should accept ${v}`);
for (const v of bad) assert.equal(parseBadgeLink(v), null, `should reject ${String(v).slice(0, 40)}`);
assert.equal(parseBadgeLink("https://münchen.de")?.hostname, "xn--mnchen-3ya.de");

console.log("badgeLink: ok");
