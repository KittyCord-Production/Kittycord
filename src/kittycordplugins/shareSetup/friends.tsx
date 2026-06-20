/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ErrorBoundary } from "@components/index";
import { openPrivateChannel, openUserProfile } from "@utils/discord";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import type { User } from "@vencord/discord-types";
import { Alerts, IconUtils, PresenceStore, React, RelationshipStore, ScrollerThin, showToast, Text, Toasts, UserStore, useStateFromStores } from "@webpack/common";
import type { ComponentType, ReactNode } from "react";

import { BRAND_ICON } from "../../branding";
import { sendFileToUser } from "../_shared/dm";
import { openInvite } from "../_shared/inviteModal";
import { buildModeFile } from "../modes/share";
import { getModes, loadModes, type Mode } from "../modes/utils";
import { getKittycordFriendIds, getShareConsent, registerSelf, setShareConsent } from "./registry";
import { sendShare } from "./utils";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const DEFAULT_NOTE = "Here's my Kittycord setup — open it in Kittycord to import.";

const STATUS_LABEL: Record<string, string> = {
    online: "Online", mobile: "Online", streaming: "Streaming", idle: "Idle", dnd: "Do Not Disturb", offline: "Offline"
};
const STATUS_AV_CLASS: Record<string, string> = {
    online: "kc-fr-av-online", mobile: "kc-fr-av-online", streaming: "kc-fr-av-streaming", idle: "kc-fr-av-idle", dnd: "kc-fr-av-dnd"
};
const STATUS_RANK: Record<string, number> = { online: 0, mobile: 0, streaming: 1, idle: 2, dnd: 3 };
const statusRank = (status: string) => STATUS_RANK[status] ?? 4;

const displayName = (user: User) => user.globalName || user.username;

export type FriendsPhase = "loading" | "needConsent" | "disabled" | "ready";

export function useKittycordFriends() {
    const [phase, setPhase] = React.useState<FriendsPhase>("loading");
    const [friends, setFriends] = React.useState<User[]>([]);

    const reload = React.useCallback(async () => {
        setPhase("loading");
        await registerSelf();
        const ids = await getKittycordFriendIds();
        setFriends(ids.map(id => UserStore.getUser(id)).filter((u): u is User => Boolean(u)));
        setPhase("ready");
    }, []);

    React.useEffect(() => {
        (async () => {
            const { consent, endpointConfigured } = await getShareConsent();
            if (!endpointConfigured) return setPhase("disabled");
            if (consent !== false) return reload();
            setPhase("needConsent");
        })();
    }, [reload]);

    return { phase, friends, reload, setPhase, setFriends };
}

export function askConsent(reload: () => void) {
    Alerts.show({
        title: "Find friends who use Kittycord?",
        body: (
            <div style={{ textAlign: "left" }}>
                <Text variant="text-md/normal">
                    To show which of your friends use Kittycord, your friend list is sent to the Kittycord server, which replies with the ones that have it.
                </Text>
                <Text variant="text-sm/normal" style={{ marginTop: 8, opacity: 0.8 }}>
                    The server only ever stores a salted hash of each opted-in user's id — never your friend list, your token, or any messages. You can turn this off anytime.
                </Text>
            </div>
        ),
        confirmText: "Enable & find friends",
        cancelText: "Not now",
        onConfirm: async () => {
            await setShareConsent(true);
            await reload();
        }
    });
}

export function FriendRow({ user, status, actions }: { user: User; status?: string; actions: ReactNode; }) {
    const active = !!status && status !== "offline";
    return (
        <div className={"kc-fr-row" + (active ? " kc-fr-row-online" : "")}>
            <div className={"kc-fr-av" + (status && STATUS_AV_CLASS[status] ? " " + STATUS_AV_CLASS[status] : "")}>
                <img src={IconUtils.getUserAvatarURL(user)} width={36} height={36} alt="" />
            </div>
            <div className="kc-fr-meta">
                <div className="kc-fr-name">{displayName(user)}</div>
                {status && <div className="kc-fr-status">{STATUS_LABEL[status] ?? "Offline"}</div>}
            </div>
            <div className="kc-fr-acts">{actions}</div>
        </div>
    );
}

export function KittycordFriendsRoster({ phase, friends, reload, onStopDiscoverable, renderActions }: {
    phase: FriendsPhase;
    friends: User[];
    reload: () => void;
    onStopDiscoverable: () => void;
    renderActions: (user: User) => ReactNode;
}) {
    const statuses = useStateFromStores([PresenceStore], () => {
        const map: Record<string, string> = {};
        for (const u of friends) map[u.id] = PresenceStore.getStatus(u.id) ?? "offline";
        return map;
    }, [friends]);

    const sorted = React.useMemo(() => [...friends].sort((a, b) => {
        const rank = statusRank(statuses[a.id] ?? "offline") - statusRank(statuses[b.id] ?? "offline");
        return rank !== 0 ? rank : displayName(a).localeCompare(displayName(b));
    }), [friends, statuses]);

    if (phase === "loading")
        return <div className="kc-fr-empty">Looking…</div>;

    if (phase === "disabled")
        return (
            <div className="kc-fr-empty">
                Friend discovery isn't available here. You can still right-click any friend and choose “Send my Kittycord setup”.
            </div>
        );

    if (phase === "needConsent")
        return (
            <div className="kc-fr-consent">
                <Text variant="text-sm/normal" style={{ color: "var(--text-normal)", marginBottom: 10 }}>
                    See which of your friends use Kittycord and reach them in one click.
                </Text>
                <button className="kc-fr-btn kc-fr-btn-primary" onClick={() => askConsent(reload)}>Find my Kittycord friends</button>
            </div>
        );

    if (friends.length === 0)
        return (
            <div className="kc-fr-empty">
                None of your friends are registered yet — tell them to enable this in Kittycord! 🐱
            </div>
        );

    return (
        <>
            <div className="kc-fr-section">
                <span className="kc-fr-section-title">On Kittycord</span>
                <span className="kc-fr-pill-count">{friends.length}</span>
            </div>
            <ScrollerThin style={{ maxHeight: 320 }}>
                <div className="kc-fr-list">
                    {sorted.map(user => (
                        <FriendRow key={user.id} user={user} status={statuses[user.id] ?? "offline"} actions={renderActions(user)} />
                    ))}
                </div>
            </ScrollerThin>
            <button className="kc-fr-link" onClick={onStopDiscoverable}>Stop being discoverable</button>
        </>
    );
}

export function InviteMoreSection({ excludeIds }: { excludeIds: Set<string>; }) {
    const others = React.useMemo(() => RelationshipStore.getFriendIDs()
        .filter(id => !excludeIds.has(id))
        .map(id => UserStore.getUser(id))
        .filter((u): u is User => Boolean(u))
        .sort((a, b) => displayName(a).localeCompare(displayName(b))), [excludeIds]);

    if (others.length === 0) return null;

    return (
        <>
            <div className="kc-fr-section">
                <span className="kc-fr-section-title">Invite more friends</span>
                <span className="kc-fr-pill-count">{others.length}</span>
            </div>
            <ScrollerThin style={{ maxHeight: 260 }}>
                <div className="kc-fr-list">
                    {others.map(user => (
                        <FriendRow
                            key={user.id}
                            user={user}
                            actions={<button className="kc-fr-btn kc-fr-btn-primary" onClick={() => openInvite(user)}>Invite 💌</button>}
                        />
                    ))}
                </div>
            </ScrollerThin>
        </>
    );
}

function SendModeModal({ rootProps, user }: { rootProps: any; user: User; }) {
    const [modes, setModes] = React.useState<Mode[]>(getModes());
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        if (modes.length === 0) loadModes().then(() => setModes([...getModes()])).catch(() => { });
    }, []);

    async function send(mode: Mode) {
        setBusy(true);
        try {
            await sendFileToUser(user.id, buildModeFile(mode), `Here's my "${mode.name}" mode — open it in Kittycord to use it.`);
            showToast(`Sent "${mode.name}" to ${displayName(user)}.`, Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send the mode."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Send a mode to {displayName(user)}</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {modes.length === 0 ? (
                    <Text variant="text-sm/normal" style={{ margin: "12px 0", opacity: 0.8 }}>
                        You haven't created any modes yet. Make one from the Kittycord menu → Modes.
                    </Text>
                ) : (
                    <div className="kc-fr-list" style={{ margin: "12px 0" }}>
                        {modes.map(mode => (
                            <div className="kc-fr-row" key={mode.id}>
                                <div className="kc-fr-meta">
                                    <div className="kc-fr-name">{mode.emoji ? mode.emoji + " " : ""}{mode.name}</div>
                                </div>
                                <div className="kc-fr-acts">
                                    <button className="kc-fr-btn kc-fr-btn-primary" disabled={busy} onClick={() => send(mode)}>Send</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </ModalContent>
        </ModalRoot>
    );
}

function FriendsListBody() {
    const { phase, friends, reload, setPhase, setFriends } = useKittycordFriends();
    const excludeIds = React.useMemo(() => new Set(friends.map(f => f.id)), [friends]);

    async function stopDiscoverable() {
        await setShareConsent(false);
        setFriends([]);
        setPhase("needConsent");
    }

    function sendSetup(user: User) {
        sendShare(user.id, "plugins", DEFAULT_NOTE)
            .then(() => showToast(`Sent to ${displayName(user)}.`, Toasts.Type.SUCCESS))
            .catch(e => showToast(String((e as Error)?.message ?? "Could not send the setup."), Toasts.Type.FAILURE));
    }

    return (
        <>
            <KittycordFriendsRoster
                phase={phase}
                friends={friends}
                reload={reload}
                onStopDiscoverable={stopDiscoverable}
                renderActions={user => (
                    <>
                        <button className="kc-fr-btn kc-fr-btn-ghost" onClick={() => openPrivateChannel(user.id)}>Message</button>
                        <button className="kc-fr-btn kc-fr-btn-ghost" onClick={() => { openUserProfile(user.id).catch(() => { }); }}>Profile</button>
                        <button className="kc-fr-btn kc-fr-btn-primary" onClick={() => sendSetup(user)}>Send setup</button>
                        <button className="kc-fr-btn kc-fr-btn-ghost" onClick={() => openModal(props => <SendModeModal rootProps={props} user={user} />)}>Send mode</button>
                    </>
                )}
            />
            <InviteMoreSection excludeIds={excludeIds} />
        </>
    );
}

export function FriendsListModal({ rootProps }: { rootProps: any; }) {
    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <img src={BRAND_ICON} width={24} height={24} style={{ borderRadius: 7, marginRight: 10 }} alt="" />
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Your Kittycord friends</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <div className="kc-fr-modalbody">
                    <FriendsListBody />
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

export function KittycordFriendsTab() {
    return (
        <ErrorBoundary noop>
            <div className="kc-fr-tab">
                <div className="kc-fr-hero">
                    <img className="kc-fr-hero-cat" src={BRAND_ICON} alt="" />
                    <div>
                        <div className="kc-fr-hero-title">Your Kittycord friends</div>
                        <div className="kc-fr-hero-sub">Message them, peek at their profile, or send your setup — then invite the friends who don't have Kittycord yet.</div>
                    </div>
                </div>
                <FriendsListBody />
            </div>
        </ErrorBoundary>
    );
}
