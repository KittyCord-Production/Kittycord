/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/index";
import { escapeRegExp } from "@utils/text";
import type { Message } from "@vencord/discord-types";
import { Button, Text, UserStore } from "@webpack/common";

import { BRAND_WEBSITE } from "../../branding";
import { openCommandsImport, openPackImport } from "./PackGallery";
import { importCommands, settings } from "./settings";

const PACK_LINK_RE = new RegExp(`${escapeRegExp(BRAND_WEBSITE)}/p/\\?id=([\\w-]{1,64})`);
const CODE_RE = /KCMD[12]:[A-Za-z0-9+/=]+/;

export function findShare(content: string): { kind: "link"; value: string; } | { kind: "code"; value: string; } | null {
    const link = content.match(PACK_LINK_RE);
    if (link) return { kind: "link", value: link[1] };

    const code = content.match(CODE_RE);
    if (code) return { kind: "code", value: code[0] };

    return null;
}

function ImportCardInner({ message }: { message: Message; }) {
    const share = findShare(message.content ?? "");
    if (!share) return null;

    const own = message.author?.id === UserStore.getCurrentUser()?.id;
    const prefix = settings.store.prefix.trim() || ".";
    const commands = share.kind === "code" ? importCommands(share.value) : null;

    if (share.kind === "code" && !commands) return null;

    const sender = message.author?.username ?? "Someone";
    const what = commands
        ? commands.map(c => `${prefix}${c.trigger}`).join(" ")
        : "a command";

    function add() {
        if (share!.kind === "link") openPackImport(share!.value);
        else openCommandsImport(commands!, what, own ? "you" : sender);
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, margin: "4px 0", borderRadius: 8, background: "var(--background-secondary)" }}>
            <Text variant="text-md/semibold" style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                ⌨️ {own ? `You shared ${what}` : `${sender} shared ${what}`}
            </Text>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={add}>Add</Button>
        </div>
    );
}

export const ImportCard = ErrorBoundary.wrap(ImportCardInner, { noop: true });
