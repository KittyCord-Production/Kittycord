/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type PreprocessAudioData } from "@api/AudioPlayer";
import { findGroupChildrenByChildId } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Menu, UserStore } from "@webpack/common";
import type { ReactElement } from "react";

import {
    addRule,
    clearAudioCache,
    CURATED,
    findRule,
    listAudio,
    loadAudioCache,
    matchRule,
    removeRule,
    resolveSound,
    type RuleScope,
    settings
} from "./store";

const NOTIFY_SOUNDS = new Set(["message1", "message2", "message3", "mention1", "mention2", "mention3"]);
const CONTEXT_WINDOW_MS = 2000;

let lastContext: { authorId: string; channelId: string; guildId?: string; at: number; } | null = null;

function SoundSubmenu({ scope, targetId }: { scope: RuleScope; targetId: string; }) {
    const current = findRule(scope, targetId);
    const files = listAudio();

    return (
        <Menu.MenuItem id="kc-sound-studio" label="Notification sound">
            <Menu.MenuRadioItem
                id="kc-sound-default"
                group="kc-sound"
                label="Default"
                checked={!current}
                action={() => current && removeRule(current.id)}
            />
            <Menu.MenuSeparator />
            {CURATED.map(sound => (
                <Menu.MenuRadioItem
                    key={sound.id}
                    id={`kc-sound-${sound.id}`}
                    group="kc-sound"
                    label={sound.label}
                    checked={current?.sound.kind === "curated" && current.sound.id === sound.id}
                    action={() => addRule({ scope, targetId, sound: { kind: "curated", id: sound.id }, volume: 100 })}
                />
            ))}
            {files.length > 0 && <Menu.MenuSeparator />}
            {files.map(file => (
                <Menu.MenuRadioItem
                    key={file.fileId}
                    id={`kc-sound-file-${file.fileId}`}
                    group="kc-sound"
                    label={file.name}
                    checked={current?.sound.kind === "file" && current.sound.fileId === file.fileId}
                    action={() => addRule({ scope, targetId, sound: { kind: "file", fileId: file.fileId }, volume: 100 })}
                />
            ))}
        </Menu.MenuItem>
    );
}

type MenuChildren = Array<ReactElement<any> | null | undefined>;

function insert(children: MenuChildren, scope: RuleScope, targetId: string) {
    const group = findGroupChildrenByChildId("mute-channel", children)
        ?? findGroupChildrenByChildId("privacy", children)
        ?? children;
    group.push(<SoundSubmenu scope={scope} targetId={targetId} />);
}

export default definePlugin({
    name: "SoundStudio",
    description: "Give a person, a server or a channel its own notification sound, then share your setup as a pack.",
    authors: [{ name: "Kittycord", id: 0n }],
    dependencies: ["AudioPlayerAPI", "ContextMenuAPI"],
    tags: ["Notifications", "Customisation"],
    settings,

    contextMenus: {
        "user-context"(children, props: { user?: { id: string; }; }) {
            if (props.user) insert(children, "friend", props.user.id);
        },
        "guild-context"(children, props: { guild?: { id: string; }; }) {
            if (props.guild) insert(children, "guild", props.guild.id);
        },
        "channel-context"(children, props: { channel?: { id: string; }; }) {
            if (props.channel) insert(children, "channel", props.channel.id);
        }
    },

    flux: {
        MESSAGE_CREATE(payload: any) {
            const message = payload?.message;
            const authorId = message?.author?.id;
            if (!authorId || authorId === UserStore.getCurrentUser()?.id) return;

            lastContext = {
                authorId,
                channelId: String(payload?.channelId ?? message?.channel_id ?? ""),
                guildId: payload?.guildId ?? message?.guild_id ?? undefined,
                at: Date.now()
            };
        }
    },

    audioProcessor(data: PreprocessAudioData) {
        if (!NOTIFY_SOUNDS.has(data.audio)) return;
        if (!lastContext || Date.now() - lastContext.at > CONTEXT_WINDOW_MS) return;

        const rule = matchRule(lastContext.authorId, lastContext.channelId, lastContext.guildId);
        if (!rule) return;

        const audio = resolveSound(rule.sound);
        if (!audio) return;

        data.audio = audio;
        data.volume = rule.volume;
    },

    async start() {
        await loadAudioCache();
    },

    stop() {
        lastContext = null;
        clearAudioCache();
    }
});
