/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import ErrorBoundary from "@components/ErrorBoundary";
import { OwnerCrownIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { copyWithToast } from "@utils/discord";
import { removeFromArray } from "@utils/misc";
import { openModal } from "@utils/modal";
import definePlugin, { type PluginNative } from "@utils/types";
import { Button, IconUtils, React, showToast, Text, TextInput, Toasts, UserStore, UserUtils } from "@webpack/common";

import { inviteClaimUrl } from "../../branding";
import { INVITE_STATS_FILENAME, renderInviteStatsCard } from "../_shared/inviteStatsCard";
import { ShareFileModal } from "../_shared/ShareFileModal";
import { CATALOG, type Deko } from "../kittyDeko/catalog";
import type { MyInvites } from "./native";
import style from "./style.css?managed";

const Native = VencordNative?.pluginHelpers?.KittyInvites as PluginNative<typeof import("./native")> | undefined;

let claimed = false;
let claiming = false;

async function tryClaim() {
    if (claimed || claiming || !Native) return;
    const me = UserStore.getCurrentUser();
    if (!me) return;
    claiming = true;
    try {
        const code = await Native.readReferralCode();
        if (!code) { claimed = true; return; }
        const status = await Native.claim(me.id, code);
        if (status === "ok" || status === "rejected") {
            claimed = true;
            await Native.clearReferralCode();
        }
    } catch { /* transient — retry on the next connection */ } finally {
        claiming = false;
    }
}

async function openInviteStatsShare() {
    const me = UserStore.getCurrentUser();
    if (!Native || !me) {
        showToast("Invite stats are available on the Kittycord desktop app.", Toasts.Type.FAILURE);
        return;
    }
    try {
        const mine = await Native.getMe(me.id);
        const name = (me as any).globalName || me.username;
        const avatar = IconUtils.getUserAvatarURL(me, false, 128);
        const blob = await renderInviteStatsCard(name, avatar, mine.invites, mine.rank);
        const file = new File([blob], INVITE_STATS_FILENAME, { type: "image/png" });
        openModal(props => (
            <ShareFileModal
                rootProps={props}
                title="Share your invite stats"
                blurb="Show off how many friends you've brought to Kittycord."
                buildFile={() => file}
                defaultNote={`I've invited ${mine.invites} ${mine.invites === 1 ? "friend" : "friends"} to Kittycord 🐱 kittycord.dev`}
            />
        ));
    } catch {
        showToast("Couldn't build your card — try again.", Toasts.Type.FAILURE);
    }
}

function daysLeft(end: number): string {
    const days = Math.ceil((end - Date.now()) / 86_400_000);
    return days <= 1 ? "less than a day" : `${days} days`;
}

function InvitesTab() {
    const me = UserStore.getCurrentUser();
    const [code, setCode] = React.useState("");
    const [mine, setMine] = React.useState<MyInvites>({ code: null, invites: 0, rank: null, invitedBy: null, seasonInvites: 0, seasonRank: null, season: null });
    const [board, setBoard] = React.useState<{ id: string; n: number; }[]>([]);
    const [seasonBoard, setSeasonBoard] = React.useState<{ id: string; n: number; }[]>([]);
    const [seasonMode, setSeasonMode] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [claimInput, setClaimInput] = React.useState("");
    const [claiming, setClaiming] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);

    const userName = (id: string) => {
        const u = UserStore.getUser(id);
        return (u as any)?.globalName || u?.username || id;
    };

    function ensureUser(id: string) {
        if (!UserStore.getUser(id)) UserUtils.getUser(id).then(() => forceUpdate()).catch(() => { });
    }

    async function load() {
        if (!Native || !me) return;
        const [m, b, sb] = await Promise.all([Native.getMe(me.id), Native.getLeaderboard(100), Native.getLeaderboard(100, "current")]);
        setMine(m);
        if (m.code) setCode(m.code);
        if (m.invitedBy) ensureUser(m.invitedBy);
        setBoard(b);
        setSeasonBoard(sb);
        for (const e of [...b, ...sb]) ensureUser(e.id);
    }

    React.useEffect(() => { load(); }, []);

    async function save() {
        if (!Native || !me) return;
        setSaving(true);
        const res = await Native.setCode(me.id, code.trim());
        setSaving(false);
        if (res.ok) {
            showToast("Creator code saved!", Toasts.Type.SUCCESS);
            load();
        } else {
            showToast(res.error, Toasts.Type.FAILURE);
        }
    }

    async function doClaim() {
        if (!Native || !me) return;
        setClaiming(true);
        const status = await Native.claim(me.id, claimInput.trim());
        setClaiming(false);
        if (status === "ok") {
            showToast("Thanks — your inviter just got the credit! 🐱", Toasts.Type.SUCCESS);
            setClaimInput("");
            load();
        } else if (status === "error") {
            showToast("Couldn't reach the server — check your connection and try again.", Toasts.Type.FAILURE);
        } else {
            showToast("Couldn't count that — wrong code, your own code, or you were already counted.", Toasts.Type.FAILURE);
        }
    }

    const gatedFrames = CATALOG
        .filter((d): d is Deko & { minInvites: number; } => typeof d.minInvites === "number")
        .sort((a, b) => a.minInvites - b.minInvites);
    const unlockedFrames = gatedFrames.filter(d => mine.invites >= d.minInvites).length;
    const nextFrame = gatedFrames.find(d => mine.invites < d.minInvites);
    const milePct = nextFrame ? Math.min(1, mine.invites / nextFrame.minInvites) : 1;

    const shareUrl = mine.code ? inviteClaimUrl(mine.code) : null;

    const list = seasonMode ? seasonBoard : board;
    const q = query.trim().toLowerCase();
    const rows = list
        .map((e, i) => ({ e, rank: i + 1 }))
        .filter(({ e }) => !q || userName(e.id).toLowerCase().includes(q));

    return (
        <ErrorBoundary noop>
            <div className="kc-inv-card">
                <Text variant="heading-md/semibold">Your creator code</Text>
                <Text variant="text-sm/normal" style={{ opacity: .75, margin: "4px 0 10px" }}>
                    Share it with friends — when they install Kittycord and type your code, it counts for you.
                </Text>
                <div className="kc-inv-coderow">
                    <TextInput value={code} onChange={setCode} placeholder="e.g. yourname" maxLength={20} />
                    <Button size={Button.Sizes.MEDIUM} disabled={saving || !code.trim()} onClick={save}>
                        {mine.code && mine.code === code.trim().toLowerCase() ? "Saved" : "Save"}
                    </Button>
                </div>
                {shareUrl && (
                    <Button
                        size={Button.Sizes.SMALL}
                        look={Button.Looks.LINK}
                        color={Button.Colors.PRIMARY}
                        onClick={() => copyWithToast(shareUrl, "Invite link copied — paste it in any chat.")}
                    >
                        Copy invite link
                    </Button>
                )}
                <Text variant="text-sm/normal" style={{ opacity: .75, marginTop: 10 }}>
                    {seasonMode
                        ? (mine.seasonInvites > 0
                            ? `This season you've invited ${mine.seasonInvites} ${mine.seasonInvites === 1 ? "person" : "people"} — rank #${mine.seasonRank}. 🐱`
                            : "No invites this season yet — share your code to climb this month's board.")
                        : (mine.invites > 0
                            ? `You've invited ${mine.invites} ${mine.invites === 1 ? "person" : "people"} all-time — rank #${mine.rank}. 🐱`
                            : "No invites yet — set a code and share it to climb the board.")}
                </Text>

                {mine.invitedBy ? (
                    <Text variant="text-sm/normal" style={{ opacity: .75, marginTop: 10 }}>
                        You were invited by <b>{userName(mine.invitedBy)}</b>. 💕
                    </Text>
                ) : (
                    <>
                        <Text variant="text-sm/normal" style={{ opacity: .75, margin: "14px 0 6px" }}>
                            Were you invited? Enter your inviter's code (once):
                        </Text>
                        <div className="kc-inv-coderow">
                            <TextInput value={claimInput} onChange={setClaimInput} placeholder="their creator code" maxLength={20} />
                            <Button size={Button.Sizes.MEDIUM} color={Button.Colors.BRAND} disabled={claiming || !claimInput.trim()} onClick={doClaim}>
                                Claim
                            </Button>
                        </div>
                    </>
                )}
            </div>

            {gatedFrames.length > 0 && (
                <div className="kc-inv-milestone">
                    <div className="kc-inv-mile-head">
                        <span className="kc-inv-mile-title">
                            {nextFrame ? `Next avatar frame: ${nextFrame.label}` : "Every invite frame unlocked 🐱"}
                        </span>
                        <span className="kc-inv-mile-count">{unlockedFrames}/{gatedFrames.length}</span>
                    </div>
                    <div className="kc-inv-mile-track">
                        <div className="kc-inv-mile-fill" style={{ transform: `scaleX(${milePct})` }} />
                    </div>
                    <Text variant="text-sm/normal" style={{ opacity: .75, marginTop: 8 }}>
                        {nextFrame
                            ? `${nextFrame.minInvites - mine.invites} more ${nextFrame.minInvites - mine.invites === 1 ? "invite" : "invites"} to unlock it in KittyDeko.`
                            : "You've earned every invite-locked frame in KittyDeko."}
                    </Text>
                </div>
            )}

            <div className="kc-inv-boardhead">
                <Text variant="heading-lg/semibold">{seasonMode ? "This season" : "All-time"} top inviters</Text>
                <div className="kc-inv-toggle">
                    <button type="button" className={"kc-inv-seg" + (seasonMode ? " kc-inv-seg-on" : "")} onClick={() => setSeasonMode(true)}>Season</button>
                    <button type="button" className={"kc-inv-seg" + (!seasonMode ? " kc-inv-seg-on" : "")} onClick={() => setSeasonMode(false)}>All-time</button>
                </div>
            </div>
            {seasonMode && mine.season && (
                <Text variant="text-sm/normal" style={{ opacity: .7, margin: "0 0 10px" }}>
                    {mine.season.label} — {daysLeft(mine.season.end)} left. The board resets next month, so it's anyone's to win. 🐱
                </Text>
            )}
            {list.length > 0 && (
                <div className="kc-inv-search">
                    <TextInput value={query} onChange={setQuery} placeholder="Search names…" />
                </div>
            )}
            <div className="kc-inv-board">
                {list.length === 0 && (
                    <Text variant="text-sm/normal" style={{ opacity: .6 }}>
                        {seasonMode ? "No invites yet this season — be the first!" : "Nobody on the board yet — be the first!"}
                    </Text>
                )}
                {list.length > 0 && rows.length === 0 && (
                    <Text variant="text-sm/normal" style={{ opacity: .6 }}>
                        No inviters match your search.
                    </Text>
                )}
                {rows.map(({ e, rank }) => {
                    const user = UserStore.getUser(e.id);
                    const name = userName(e.id);
                    const avatar = user ? IconUtils.getUserAvatarURL(user, false, 64) : undefined;
                    return (
                        <div className={"kc-inv-row" + (rank <= 3 ? ` kc-inv-top${rank}` : "") + (me && e.id === me.id ? " kc-inv-me" : "")} key={e.id}>
                            <span className="kc-inv-rank">{rank}</span>
                            {avatar ? <img className="kc-inv-av" src={avatar} alt="" /> : <div className="kc-inv-av" />}
                            <span className="kc-inv-name">{name}</span>
                            <span className="kc-inv-count">{e.n}</span>
                        </div>
                    );
                })}
            </div>
        </ErrorBoundary>
    );
}

export default definePlugin({
    name: "KittyInvites",
    description: "See who invited the most people to Kittycord. Claim your own creator code and climb the monthly leaderboard.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Friends", "Fun"],
    enabledByDefault: true,

    toolboxActions: {
        "Share invite stats"() {
            openInviteStatsShare();
        }
    },

    flux: {
        CONNECTION_OPEN() {
            tryClaim();
        }
    },

    async start() {
        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "kittycord_invites",
            title: "Invites",
            panelTitle: "Invite Leaderboard",
            Component: InvitesTab,
            Icon: OwnerCrownIcon
        });
        tryClaim();
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_invites");
        disableStyle(style);
    }
});
