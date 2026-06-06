/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import definePlugin from "@utils/types";
import { React, useState } from "@webpack/common";

const COLLAPSED_CLASS = "kc-backpack-collapsed";
let collapsed = false;

function applyCollapsed(value: boolean) {
    collapsed = value;
    document.body.classList.toggle(COLLAPSED_CLASS, value);
}

function BackpackIcon({ width = 22, height = 22 }: { width?: string | number; height?: string | number; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 8V6a5 5 0 0 1 10 0v2h.5A2.5 2.5 0 0 1 20 10.5v8A2.5 2.5 0 0 1 17.5 21h-11A2.5 2.5 0 0 1 4 18.5v-8A2.5 2.5 0 0 1 6.5 8H7Zm2 0h6V6a3 3 0 1 0-6 0v2Zm-1 5a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Z" />
        </svg>
    );
}

const BackpackButton: ChatBarButtonFactory = ({ isMainChat }) => {
    const [open, setOpen] = useState(!collapsed);
    if (!isMainChat) return null;

    return (
        <ChatBarButton
            tooltip={open ? "Pack chat-bar buttons away (Backpack)" : "Unpack chat-bar buttons (Backpack)"}
            onClick={() => {
                const next = !open;
                setOpen(next);
                applyCollapsed(!next);
            }}
        >
            <span className="kc-backpack-marker" style={{ opacity: open ? 1 : 0.55 }}>
                <BackpackIcon />
            </span>
        </ChatBarButton>
    );
};

export default definePlugin({
    name: "Backpack",
    description: "Collapse your other chat-bar plugin buttons behind a single button to declutter the message bar. Click to pack/unpack.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        icon: BackpackIcon,
        render: BackpackButton
    },

    stop() {
        applyCollapsed(false);
    }
});
