/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/index";
import definePlugin from "@utils/types";
import type { Message, User } from "@vencord/discord-types";
import { Button, Menu, Text, UserStore } from "@webpack/common";

import { INVITE_FILENAME } from "../_shared/inviteCard";
import { openInvite } from "../_shared/inviteModal";

function InviteAccessoryInner({ message }: { message: Message; }) {
    const own = message.author?.id === UserStore.getCurrentUser()?.id;
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, margin: "4px 0", borderRadius: 8, background: "var(--background-secondary)" }}>
            <Text variant="text-md/semibold" style={{ flex: 1 }}>
                {own ? "💌 Your Kittycord invite" : "💖 You already have Kittycord — share the love!"}
            </Text>
            {!own && (
                <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={() => openInvite(null)}>
                    Invite someone
                </Button>
            )}
        </div>
    );
}

const InviteAccessory = ErrorBoundary.wrap(InviteAccessoryInner, { noop: true });

export default definePlugin({
    name: "InviteFriend",
    description: "Invite friends to Kittycord with a cute, ready-to-send invite card — works even if they don't have Kittycord yet.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    dependencies: ["MessageAccessoriesAPI", "ContextMenuAPI"],
    enabledByDefault: true,

    toolboxActions: {
        "Invite a friend"() {
            openInvite(null);
        }
    },

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            if (!user || user.bot || user.id === UserStore.getCurrentUser()?.id) return;
            children.push(
                <Menu.MenuItem
                    id="vc-invitefriend-send"
                    label="Invite to Kittycord…"
                    action={() => openInvite(user)}
                />
            );
        }
    },

    renderMessageAccessory({ message }) {
        const hasInvite = message.attachments?.some(a => a.filename === INVITE_FILENAME);
        if (!hasInvite) return null;
        return <InviteAccessory message={message} />;
    }
});
