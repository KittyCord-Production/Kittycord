/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Card } from "@components/Card";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Button, React, Text } from "@webpack/common";

import { cancelBreak, currentStatus, setStatus, settings, takeBreak } from "./controls";
import { recentDays } from "./state";

const STATUS_OPTIONS = [
    { value: "online", label: "Online" },
    { value: "idle", label: "Idle" },
    { value: "dnd", label: "Do Not Disturb" },
    { value: "invisible", label: "Invisible" }
];

function fmt(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

export function WellbeingTab() {
    const store = settings.use(["breakReminders", "breakInterval", "dailyGoalMin"]);
    const [status, setStatusState] = React.useState(currentStatus);

    const week = recentDays(7);
    const today = week[week.length - 1];
    const goal = Number(store.dailyGoalMin) || 0;
    const maxMin = Math.max(1, ...week.map(d => d.activeMin));

    function pick(s: string) {
        setStatus(s);
        setStatusState(s);
    }

    return (
        <ErrorBoundary noop>
            <div className="kc-well">
                <Text variant="heading-lg/semibold">Your Discord, gently 🐱</Text>
                <Text variant="text-md/normal" style={{ marginTop: 6, opacity: .8 }}>
                    A little picture of how you spend time here. All of it stays on your computer and is never sent anywhere.
                </Text>

                <div className="kc-well-cards">
                    <Card className="kc-well-card">
                        <Text variant="text-sm/semibold" style={{ opacity: .7 }}>Today</Text>
                        <Text variant="heading-xl/semibold">{fmt(today.activeMin)}</Text>
                        <Text variant="text-sm/normal" style={{ opacity: .7 }}>active on Discord</Text>
                        {goal > 0 && (
                            <Text variant="text-xs/normal" style={{ marginTop: 4, opacity: .7 }}>
                                {today.activeMin <= goal
                                    ? `Within your ${fmt(goal)} goal — nice 💖`
                                    : `A little past your ${fmt(goal)} goal — be kind to yourself 🌿`}
                            </Text>
                        )}
                    </Card>
                    <Card className="kc-well-card">
                        <Text variant="text-sm/semibold" style={{ opacity: .7 }}>Messages today</Text>
                        <Text variant="heading-xl/semibold">{today.messages}</Text>
                        <Text variant="text-sm/normal" style={{ opacity: .7 }}>sent by you</Text>
                    </Card>
                </div>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>This week</Text>
                <div className="kc-well-week">
                    {week.map(d => (
                        <div className="kc-well-bar" key={d.date} title={`${fmt(d.activeMin)} · ${d.messages} messages`}>
                            <div className="kc-well-bar-fill" style={{ height: `${Math.round((d.activeMin / maxMin) * 100)}%` }} />
                            <span className="kc-well-bar-label">{new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
                        </div>
                    ))}
                </div>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Gentle reminders</Text>
                <FormSwitch
                    title="Nudge me to take breaks"
                    description="A soft, friendly reminder after you've been here a while. It never blocks anything."
                    value={store.breakReminders}
                    onChange={v => { store.breakReminders = v; }}
                    hideBorder
                />
                {store.breakReminders && (
                    <Flex style={{ gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                        {[45, 60, 90, 120].map(m => (
                            <Button
                                key={m}
                                color={Number(store.breakInterval) === m ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                                onClick={() => { store.breakInterval = m; }}
                            >{fmt(m)}</Button>
                        ))}
                    </Flex>
                )}

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Daily goal</Text>
                <Text variant="text-sm/normal" style={{ opacity: .7, marginBottom: 8 }}>A soft target, just for you — never a limit.</Text>
                <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                    {[{ v: 0, l: "No goal" }, { v: 60, l: "1h" }, { v: 120, l: "2h" }, { v: 180, l: "3h" }].map(o => (
                        <Button
                            key={o.v}
                            color={goal === o.v ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            onClick={() => { store.dailyGoalMin = o.v; }}
                        >{o.l}</Button>
                    ))}
                </Flex>

                <Text variant="heading-md/semibold" style={{ marginTop: 20 }}>Calm controls</Text>
                <Text variant="text-sm/normal" style={{ opacity: .7, marginBottom: 8 }}>Set your status instantly, or take a quiet break that restores itself.</Text>
                <Flex style={{ gap: 8, flexWrap: "wrap" }}>
                    {STATUS_OPTIONS.map(o => (
                        <Button
                            key={o.value}
                            color={status === o.value ? Button.Colors.BRAND : Button.Colors.PRIMARY}
                            onClick={() => pick(o.value)}
                        >{o.label}</Button>
                    ))}
                </Flex>
                <Flex style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <Button color={Button.Colors.PRIMARY} onClick={() => { takeBreak(15); setStatusState("dnd"); }}>Break · 15 min</Button>
                    <Button color={Button.Colors.PRIMARY} onClick={() => { takeBreak(30); setStatusState("dnd"); }}>Break · 30 min</Button>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => { cancelBreak(); setStatusState(currentStatus()); }}>Cancel break</Button>
                </Flex>
            </div>
        </ErrorBoundary>
    );
}
