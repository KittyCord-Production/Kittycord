/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { playAudio } from "@api/AudioPlayer";
import { BaseText } from "@components/BaseText";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Flex } from "@components/Flex";
import { DeleteIcon } from "@components/Icons";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { copyWithToast } from "@utils/discord";
import { ChannelStore, GuildStore, React, showToast, Toasts, UserStore } from "@webpack/common";

import {
    addAudio,
    exportRules,
    importRules,
    isAllowedMime,
    listAudio,
    loadAudioCache,
    MAX_FILE_BYTES,
    removeAudio,
    removeRule,
    resolveSound,
    type RuleScope,
    settings,
    soundLabel,
    type SoundRule
} from "./store";

const SCOPE_LABEL: Record<RuleScope, string> = {
    friend: "Person",
    guild: "Server",
    channel: "Channel"
};

function targetName(rule: SoundRule): string {
    if (rule.scope === "friend") {
        const user = UserStore.getUser(rule.targetId);
        return user ? (user.globalName as string) || user.username : rule.targetId;
    }
    if (rule.scope === "guild") return GuildStore.getGuild(rule.targetId)?.name ?? rule.targetId;
    const channel = ChannelStore.getChannel(rule.targetId);
    return channel ? `#${channel.name}` : rule.targetId;
}

function preview(rule: SoundRule) {
    const audio = resolveSound(rule.sound);
    if (!audio) {
        showToast("That sound file is missing.", Toasts.Type.FAILURE);
        return;
    }
    playAudio(audio, { volume: rule.volume });
}

export function RuleList() {
    const { rules } = settings.use(["rules"]);
    const [files, setFiles] = React.useState(listAudio());
    const [code, setCode] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        loadAudioCache().then(() => setFiles(listAudio()));
    }, []);

    async function upload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!isAllowedMime(file.type)) {
            showToast("That file type isn't supported.", Toasts.Type.FAILURE);
            return;
        }
        if (file.size > MAX_FILE_BYTES) {
            showToast(`Sounds have to stay under ${Math.round(MAX_FILE_BYTES / 1000)} KB.`, Toasts.Type.FAILURE);
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                await addAudio(file.name.replace(/\.[^.]+$/, "").slice(0, 60), file.type, String(reader.result));
                setFiles(listAudio());
                showToast("Sound added — pick it from a right-click menu.", Toasts.Type.SUCCESS);
            } catch (e) {
                showToast(String((e as Error)?.message ?? "Could not add that sound."), Toasts.Type.FAILURE);
            }
        };
        reader.readAsDataURL(file);
    }

    async function importCode() {
        const result = await importRules(code);
        if (!result) {
            showToast("That isn't a valid sound pack.", Toasts.Type.FAILURE);
            return;
        }
        setCode("");
        setFiles(listAudio());
        showToast(`Added ${result.added} rule${result.added === 1 ? "" : "s"}.`, Toasts.Type.SUCCESS);
    }

    function share() {
        const { code: shareCode, skipped } = exportRules(rules);
        copyWithToast(
            shareCode,
            skipped
                ? `Sound pack copied — ${skipped} rule${skipped === 1 ? "" : "s"} with a large file were left out.`
                : "Sound pack copied — share it with anyone."
        );
    }

    return (
        <section className={Margins.top8}>
            <BaseText size="md" weight="semibold">Your Sound Rules</BaseText>
            <Paragraph size="sm" className={Margins.top8}>
                Right-click a person or a server and pick "Notification sound" to make a rule. A person beats a channel, a channel beats a server.
            </Paragraph>

            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {rules.map(rule => (
                    <Card key={rule.id} className="vc-soundStudio-card">
                        <div className="vc-soundStudio-info">
                            <Paragraph size="md" weight="medium">{SCOPE_LABEL[rule.scope]}: {targetName(rule)}</Paragraph>
                            <Paragraph size="sm" className="vc-soundStudio-sub">{soundLabel(rule.sound)} · {rule.volume}%</Paragraph>
                        </div>
                        <Button variant="secondary" size="iconOnly" onClick={() => preview(rule)}>▶</Button>
                        <Button variant="dangerSecondary" size="iconOnly" onClick={() => removeRule(rule.id)}>
                            <DeleteIcon aria-label="Delete rule" width={20} height={20} />
                        </Button>
                    </Card>
                ))}
                {rules.length === 0 && (
                    <Paragraph size="sm" className="vc-soundStudio-sub">No rules yet.</Paragraph>
                )}
            </Flex>

            <BaseText size="md" weight="semibold" className={Margins.top16}>Your Sounds</BaseText>
            <Flex flexDirection="column" gap="0.5em" className={Margins.top8}>
                {files.map(file => (
                    <Card key={file.fileId} className="vc-soundStudio-card">
                        <div className="vc-soundStudio-info">
                            <Paragraph size="md" weight="medium">{file.name}</Paragraph>
                        </div>
                        <Button variant="secondary" size="iconOnly" onClick={() => playAudio(file.dataUri, { volume: 100 })}>▶</Button>
                        <Button
                            variant="dangerSecondary"
                            size="iconOnly"
                            onClick={async () => {
                                await removeAudio(file.fileId);
                                setFiles(listAudio());
                            }}
                        >
                            <DeleteIcon aria-label="Delete sound" width={20} height={20} />
                        </Button>
                    </Card>
                ))}
                <Flex gap="0.5em">
                    <Button onClick={() => inputRef.current?.click()}>Add a sound</Button>
                    {rules.length > 0 && <Button variant="secondary" onClick={share}>Share pack</Button>}
                    <input
                        className="vc-soundStudio-file"
                        ref={inputRef}
                        type="file"
                        accept="audio/*"
                        onChange={upload}
                    />
                </Flex>
            </Flex>

            <BaseText size="md" weight="semibold" className={Margins.top16}>Import a pack</BaseText>
            <Flex gap="0.5em" className={Margins.top8}>
                <input
                    className="vc-soundStudio-code"
                    value={code}
                    onChange={e => setCode(e.currentTarget.value)}
                    placeholder="KSND1:..."
                />
                <Button variant="secondary" disabled={!code.trim()} onClick={importCode}>Import</Button>
            </Flex>
        </section>
    );
}
