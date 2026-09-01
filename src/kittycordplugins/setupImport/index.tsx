/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { uploadSettingsBackup } from "@api/SettingsSync/offline";
import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { BackupRestoreIcon } from "@components/Icons";
import { openSettingsTabModal } from "@components/settings";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";
import { Text, useEffect, useState } from "@webpack/common";

import { Native, openImportModal } from "./ImportModal";
import type { DetectedSource } from "./native";

export const importAvailable = () => Boolean(Native);

export function useDetectedSources() {
    const [sources, setSources] = useState<DetectedSource[] | null>(null);

    useEffect(() => {
        if (!Native) return setSources([]);
        Native.detectSources().then(setSources).catch(() => setSources([]));
    }, []);

    return sources;
}

export function SourceList({ compact }: { compact?: boolean; }) {
    const sources = useDetectedSources();

    if (!sources?.length) return null;

    return (
        <div className="kc-import-list">
            {sources.map(source => (
                <div className="kc-import-card" key={source.key}>
                    <div>
                        <Text variant="text-md/semibold">{source.displayName}</Text>
                        <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                            {[
                                source.enabledCount ? `${source.enabledCount} plugins on` : null,
                                source.themeCount ? `${source.themeCount} themes` : null,
                                source.hasQuickCss ? "custom CSS" : null
                            ].filter(Boolean).join(" · ")}
                        </Text>
                    </div>
                    <Button size={compact ? "small" : "medium"} onClick={() => openImportModal(source)}>
                        Bring it over
                    </Button>
                </div>
            ))}
        </div>
    );
}

function ImportTab() {
    const sources = useDetectedSources();

    return (
        <ErrorBoundary noop>
            <div className="kc-import">
                <Text variant="heading-lg/semibold">Bring your setup</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6 }}>
                    Already used another client mod? Kittycord can read what is still on this computer and take over
                    the plugins you had on, their settings, your themes and your custom CSS. Nothing is deleted or
                    changed on the other side.
                </Text>

                {sources === null && (
                    <Text variant="text-md/normal" style={{ marginTop: 16 }}>Looking around…</Text>
                )}

                {sources?.length === 0 && (
                    <Text variant="text-md/normal" style={{ marginTop: 16, color: "var(--text-muted)" }}>
                        Nothing found on this computer. If your setup lives on another machine, export it there and
                        load the file below.
                    </Text>
                )}

                <SourceList />

                <Text variant="heading-md/semibold" style={{ marginTop: 24 }}>From a backup file</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6 }}>
                    A settings backup you exported yourself works too.
                </Text>
                <Button
                    className="kc-import-file"
                    variant="secondary"
                    onClick={() => uploadSettingsBackup()}
                >
                    Load a backup file
                </Button>
            </div>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "SetupImport",
    description: "Takes over your plugins, themes and custom CSS from another client mod on this computer, in one click.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    enabledByDefault: true,

    toolboxActions: {
        "Import a setup"() {
            openSettingsTabModal(ImportTab);
        }
    },

    start() {
        SettingsPlugin.customEntries.push({
            key: "kittycord_import",
            title: "Import setup",
            panelTitle: "Import setup",
            Component: ImportTab,
            Icon: BackupRestoreIcon
        });
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_import");
    }
});
