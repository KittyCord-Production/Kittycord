/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { saveFile } from "@utils/web";
import { React, Text } from "@webpack/common";

interface Entry {
    at: number;
    kind: string;
    method: string;
    host: string;
    path: string;
    status: number;
    bytesOut: number;
    purpose: string;
    plugin: string | null;
}

const bridge = VencordNative.kittycordPrivacy;

function formatSize(bytes: number) {
    if (!bytes) return "";
    return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} kB`;
}

function statusLabel(status: number) {
    if (!status) return "failed";
    return String(status);
}

export function RequestLog() {
    const [entries, setEntries] = React.useState<Entry[] | null>(null);
    const [totals, setTotals] = React.useState<Record<string, number>>({});

    const refresh = React.useCallback(() => {
        bridge?.getRequestLog()
            .then(log => { setEntries(log.entries as Entry[]); setTotals(log.totals); })
            .catch(() => setEntries([]));
    }, []);

    React.useEffect(() => {
        if (!bridge) return setEntries([]);
        refresh();
        const id = setInterval(refresh, 2000);
        return () => clearInterval(id);
    }, [refresh]);

    if (!bridge) {
        return (
            <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>
                The request monitor is only available in the desktop app.
            </Text>
        );
    }

    const hosts = [...new Set(entries?.map(e => e.host) ?? [])];
    const recent = [...(entries ?? [])].reverse();

    async function exportLog() {
        const log = await bridge!.getRequestLog();
        const name = `kittycord-requests-${new Date().toISOString().slice(0, 10)}.json`;
        saveFile(new File([JSON.stringify(log, null, 2)], name, { type: "application/json" }));
    }

    return (
        <>
            <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 6 }}>
                Every connection Kittycord itself opens, live. Discord's own traffic is not listed here, and neither is
                anything from the plugins you turn on that talk to Discord.
            </Text>

            <div className="kc-priv-chips">
                <div className="kc-priv-chip">
                    <b>{entries?.length ?? 0}</b> this session
                </div>
                <div className="kc-priv-chip">
                    <b>{hosts.length}</b> {hosts.length === 1 ? "server" : "servers"} contacted
                </div>
                {Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([purpose, count]) => (
                    <div className="kc-priv-chip" key={purpose}><b>{count}</b> {purpose.toLowerCase()}</div>
                ))}
            </div>

            {hosts.length > 0 && (
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 8 }}>
                    Servers so far: {hosts.join(", ")}
                </Text>
            )}

            {entries?.length === 0 && (
                <Text variant="text-sm/normal" style={{ opacity: .7, marginTop: 12 }}>
                    Nothing yet. Kittycord has not contacted anything since it started.
                </Text>
            )}

            {recent.length > 0 && (
                <div className="kc-priv-log">
                    {recent.slice(0, 60).map((entry, i) => (
                        <div className="kc-priv-log-row" key={`${entry.at}-${i}`}>
                            <span className="kc-priv-log-time">
                                {new Date(entry.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                            </span>
                            <span className="kc-priv-log-purpose">{entry.purpose}</span>
                            <span className="kc-priv-log-plugin">{entry.plugin ?? ""}</span>
                            <span className="kc-priv-log-path" title={`${entry.host}${entry.path}`}>
                                {entry.method} {entry.path}
                            </span>
                            <span className="kc-priv-log-meta">{formatSize(entry.bytesOut)} {statusLabel(entry.status)}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="kc-priv-btns">
                <Button variant="secondary" onClick={exportLog} disabled={!entries?.length}>Export this log</Button>
                <Button variant="secondary" onClick={() => bridge.clearRequestLog().then(refresh)} disabled={!entries?.length}>Clear</Button>
            </div>
        </>
    );
}
