/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { isPluginEnabled, isSettingHidden, plugins } from "@api/PluginManager";
import ErrorBoundary from "@components/ErrorBoundary";
import { BackupAndRestoreTab, ChangelogTab, CloudTab, openPluginModal, openSettingsTabModal, PluginsTab, ThemesTab, UpdaterTab, VencordTab } from "@components/settings";
import SettingsPlugin from "@plugins/_core/settings";
import { classNameFactory } from "@utils/css";
import { closeModal, ModalContent as ModalContentRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { wordsFromCamel, wordsToTitle } from "@utils/text";
import { OptionType } from "@utils/types";
import { React, ScrollerThin, Text, TextInput, useEffect, useMemo, useState } from "@webpack/common";
import type { ComponentType, KeyboardEvent } from "react";

const cl = classNameFactory("vc-kittysearch-");
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;

interface Entry {
    label: string;
    sublabel: string;
    run(): void;
}

const brand = (s: string) => s.replace(/vencord|equicord|moggcord/gi, "Kittycord");

const CORE_ENTRIES: { label: string; sublabel: string; tab: ComponentType<any> | null; }[] = [
    { label: "Kittycord settings", sublabel: "Accent color, quick actions and client settings", tab: VencordTab },
    { label: "Accent color", sublabel: "Pick the colour Kittycord's own panels use", tab: VencordTab },
    { label: "Plugins", sublabel: "Turn features on or off", tab: PluginsTab },
    { label: "Themes", sublabel: "Manage your themes and QuickCSS", tab: ThemesTab },
    { label: "Quick CSS", sublabel: "Write your own CSS", tab: ThemesTab },
    { label: "Updates", sublabel: "Check for updates and pick your update channel", tab: UpdaterTab },
    { label: "Changelog", sublabel: "See what changed in the last updates", tab: ChangelogTab },
    { label: "Cloud", sublabel: "Sync your settings across devices", tab: CloudTab },
    { label: "Backup & restore", sublabel: "Save your setup to a file or load one back", tab: BackupAndRestoreTab }
];

function buildIndex(): Entry[] {
    const out: Entry[] = [];

    for (const entry of CORE_ENTRIES) {
        const { tab } = entry;
        if (!tab) continue;
        out.push({ label: entry.label, sublabel: entry.sublabel, run: () => openSettingsTabModal(tab) });
    }

    for (const entry of SettingsPlugin.customEntries)
        out.push({ label: entry.title, sublabel: "Kittycord settings", run: () => openSettingsTabModal(entry.Component) });

    for (const p of Object.values(plugins)) {
        if (p.name.endsWith("API") || p.required || p.hidden || !isPluginEnabled(p.name)) continue;

        out.push({ label: p.name, sublabel: brand(p.description), run: () => openPluginModal(p) });

        if (p.settings) {
            for (const [key, option] of Object.entries(p.settings.def)) {
                if (option.type === OptionType.COMPONENT || isSettingHidden(p.settings, option)) continue;
                out.push({
                    label: `${p.name} › ${brand(wordsToTitle(wordsFromCamel(key)))}`,
                    sublabel: brand(option.description ?? ""),
                    run: () => openPluginModal(p)
                });
            }
        }

        if (p.toolboxActions && typeof p.toolboxActions !== "function") {
            for (const [text, action] of Object.entries(p.toolboxActions)) {
                out.push({ label: brand(text), sublabel: p.name, run: action });
            }
        }
    }
    return out;
}

function fuzzyScore(query: string, text: string): number {
    const t = text.toLowerCase();
    const sub = t.indexOf(query);
    if (sub !== -1) return 1000 - sub;

    let qi = 0, streak = 0, score = 0;
    for (let ti = 0; ti < t.length && qi < query.length; ti++) {
        if (t[ti] === query[qi]) { qi++; streak++; score += streak; }
        else streak = 0;
    }
    return qi === query.length ? score : 0;
}

const MAX_RESULTS = 40;

function SearchModal({ rootProps }: { rootProps: any; }) {
    const [query, setQuery] = useState("");
    const [sel, setSel] = useState(0);
    const index = useMemo(buildIndex, []);

    useEffect(() => () => { modalKey = null; }, []);

    const q = query.trim().toLowerCase();
    const results = useMemo(() => {
        if (!q) return index.slice(0, MAX_RESULTS);
        return index
            .map(e => ({ e, s: Math.max(fuzzyScore(q, e.label), fuzzyScore(q, e.sublabel) * 0.4) }))
            .filter(x => x.s > 0)
            .sort((a, b) => b.s - a.s)
            .slice(0, MAX_RESULTS)
            .map(x => x.e);
    }, [q, index]);

    const active = Math.min(sel, Math.max(0, results.length - 1));

    function run(entry: Entry) {
        rootProps.onClose();
        entry.run();
    }

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel(s => Math.min(s + 1, results.length - 1)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSel(s => Math.max(s - 1, 0)); }
        else if (e.key === "Enter") { e.preventDefault(); if (results[active]) run(results[active]); }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalContent>
                <div className={cl("box")} onKeyDown={onKeyDown}>
                    <TextInput
                        autoFocus
                        value={query}
                        onChange={(v: string) => { setQuery(v); setSel(0); }}
                        placeholder="Search Kittycord settings, plugins and actions…"
                    />
                    <ScrollerThin className={cl("results")}>
                        {results.length === 0
                            ? <Text variant="text-sm/normal" className={cl("empty")}>No matches.</Text>
                            : results.map((e, i) => (
                                <div
                                    key={`${e.label}-${i}`}
                                    className={cl("row", { active: i === active })}
                                    onClick={() => run(e)}
                                    onMouseEnter={() => setSel(i)}
                                >
                                    <Text variant="text-md/semibold" className={cl("label")}>{e.label}</Text>
                                    {e.sublabel ? <Text variant="text-sm/normal" className={cl("sub")}>{e.sublabel}</Text> : null}
                                </div>
                            ))}
                    </ScrollerThin>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

let modalKey: string | null = null;

export function toggleSearch() {
    if (modalKey) {
        closeModal(modalKey);
        modalKey = null;
        return;
    }
    modalKey = openModal(props => (
        <ErrorBoundary noop>
            <SearchModal rootProps={props} />
        </ErrorBoundary>
    ));
}
