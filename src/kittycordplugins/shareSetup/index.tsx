/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { showNotification } from "@api/Notifications";
import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle } from "@api/Styles";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { UserIcon } from "@components/Icons";
import { ErrorBoundary } from "@components/index";
import SettingsPlugin from "@plugins/_core/settings";
import { getUniqueUsername } from "@utils/discord";
import { Logger } from "@utils/Logger";
import { removeFromArray } from "@utils/misc";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin, { OptionType } from "@utils/types";
import type { Message, MessageAttachment, User } from "@vencord/discord-types";
import { Alerts, Button, Forms, Menu, React, RelationshipStore, SearchableSelect, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { FriendsListModal, KittycordFriendsRoster, KittycordFriendsTab, useKittycordFriends } from "./friends";
import { getShareConsent, registerSelf, setShareConsent, unregisterSelf } from "./registry";
import style from "./style.css?managed";
import { applyShare, buildSetupPreview, fetchShare, findShareAttachment, sendShare, type ShareEnvelope, type ShareScope } from "./utils";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const SCOPE_OPTIONS: { label: string; value: ShareScope; }[] = [
    { label: "Plugins & their settings", value: "plugins" },
    { label: "Themes & QuickCSS", value: "css" },
    { label: "Everything (plugins, CSS, plugin data)", value: "all" }
];
const scopeLabel = (s: ShareScope) => SCOPE_OPTIONS.find(o => o.value === s)?.label ?? s;

const logger = new Logger("ShareSetup");

const DEFAULT_NOTE = "Here's my Kittycord setup 🐱 grab Kittycord at https://kittycord.dev, then open the file to import it.";

async function enableFriendDiscovery() {
    await registerSelf();
}

function FriendDiscoveryToggle() {
    const [consent, setConsent] = React.useState<boolean | null>(null);
    const [configured, setConfigured] = React.useState(false);

    React.useEffect(() => {
        getShareConsent()
            .then(s => { setConsent(s.consent); setConfigured(s.endpointConfigured); })
            .catch(() => { });
    }, []);

    async function onChange(value: boolean) {
        setConsent(value);
        await setShareConsent(value);
        if (value) await enableFriendDiscovery();
        else await unregisterSelf();
    }

    return (
        <>
            <FormSwitch
                title="Find which friends use Kittycord"
                description="Checks your friend list against the Kittycord server to show which friends also use it, and lets them find you. The server only ever keeps a salted hash of each id — never your friend list, your token or any messages. Turning this off deletes your entry from the server."
                value={consent !== false}
                onChange={onChange}
                hideBorder
            />
            {!configured && (
                <Forms.FormText style={{ opacity: 0.7 }}>
                    Friend discovery isn't available here.
                </Forms.FormText>
            )}
        </>
    );
}

const settings = definePluginSettings({
    friendDiscovery: {
        type: OptionType.COMPONENT,
        description: "Friend discovery",
        component: FriendDiscoveryToggle
    }
});

function restartPrompt() {
    showNotification({
        title: "Setup imported — restart to apply",
        body: "Click here to restart Discord now.",
        onClick: () => (IS_WEB ? location.reload() : relaunch())
    });
}

function SendModal({ rootProps, user }: { rootProps: any; user: User; }) {
    const [scope, setScope] = React.useState<ShareScope>("plugins");
    const [note, setNote] = React.useState(DEFAULT_NOTE);
    const [busy, setBusy] = React.useState(false);
    const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        let url: string | null = null;
        setPreviewUrl(null);
        (async () => {
            const blob = await buildSetupPreview(scope);
            if (cancelled || !blob) return;
            url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        })();
        return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
    }, [scope]);

    async function send() {
        setBusy(true);
        try {
            await sendShare(user.id, scope, note.trim() || DEFAULT_NOTE);
            showToast("Setup sent.", Toasts.Type.SUCCESS);
            rootProps.onClose();
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send the setup."), Toasts.Type.FAILURE);
        } finally {
            setBusy(false);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Send your Kittycord setup</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                {previewUrl && (
                    <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
                        <img src={previewUrl} alt="Setup preview card" style={{ width: "100%", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }} />
                    </div>
                )}

                <Text variant="text-sm/normal" style={{ margin: "12px 0" }}>
                    Sends {getUniqueUsername(user)} this preview plus a file they can import — the preview shows even if they don't have Kittycord yet. Your account token is never included.
                </Text>

                <Text variant="text-sm/semibold" style={{ marginBottom: 4 }}>What to share</Text>
                <SearchableSelect options={SCOPE_OPTIONS} value={scope} onChange={(v: ShareScope) => setScope(v)} closeOnSelect />

                <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>Message</Text>
                <TextInput value={note} onChange={setNote} />

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "16px 0" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={rootProps.onClose}>Cancel</Button>
                    <Button color={Button.Colors.BRAND} disabled={busy} onClick={send}>Send</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function ImportCardInner({ message, attachment, own }: { message: Message; attachment: MessageAttachment; own: boolean; }) {
    const author = message.author?.username ?? "Someone";

    async function startImport() {
        let envelope: ShareEnvelope;
        try {
            envelope = await fetchShare(attachment);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not read that setup."), Toasts.Type.FAILURE);
            return;
        }

        Alerts.show({
            title: own ? "Restore your Kittycord setup?" : `Import ${author}'s Kittycord setup?`,
            body: (
                <div style={{ textAlign: "left" }}>
                    <Text variant="text-md/normal">Includes: <b>{scopeLabel(envelope.scope)}</b></Text>
                    {envelope.enabledPlugins.length > 0 && (
                        <Text variant="text-sm/normal" style={{ opacity: 0.8, marginTop: 4 }}>
                            {envelope.enabledPlugins.length} enabled plugin(s) in this setup.
                        </Text>
                    )}
                    <Text variant="text-sm/normal" style={{ marginTop: 8 }}>
                        This merges into your current settings and needs a restart afterwards. It can't be undone automatically.
                    </Text>
                </div>
            ),
            confirmText: own ? "Restore" : "Import",
            cancelText: "Cancel",
            onConfirm: async () => {
                try {
                    await applyShare(envelope);
                    restartPrompt();
                } catch (e) {
                    showToast(String((e as Error)?.message ?? "Import failed."), Toasts.Type.FAILURE);
                }
            }
        });
    }

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, margin: "4px 0", borderRadius: 8, background: "var(--background-secondary)" }}>
            <Text variant="text-md/semibold" style={{ flex: 1 }}>📦 {own ? "Your Kittycord setup" : `${author} shared their Kittycord setup`}</Text>
            <Button size={Button.Sizes.SMALL} color={Button.Colors.BRAND} onClick={startImport}>{own ? "Restore" : "Import"}</Button>
        </div>
    );
}

const ImportCard = ErrorBoundary.wrap(ImportCardInner, { noop: true });

function FriendsModal({ rootProps }: { rootProps: any; }) {
    const { phase, friends, reload, setPhase, setFriends } = useKittycordFriends();
    const [scope, setScope] = React.useState<ShareScope>("plugins");
    const [note, setNote] = React.useState(DEFAULT_NOTE);

    async function stopDiscoverable() {
        await setShareConsent(false);
        setFriends([]);
        setPhase("needConsent");
    }

    async function sendTo(user: User) {
        try {
            await sendShare(user.id, scope, note.trim() || DEFAULT_NOTE);
            showToast(`Sent to ${user.globalName || user.username}.`, Toasts.Type.SUCCESS);
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Could not send the setup."), Toasts.Type.FAILURE);
        }
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Share with a Kittycord friend</Text>
                <ModalCloseButton onClick={rootProps.onClose} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>What to share</Text>
                <SearchableSelect options={SCOPE_OPTIONS} value={scope} onChange={(v: ShareScope) => setScope(v)} closeOnSelect />

                <Text variant="text-sm/semibold" style={{ margin: "12px 0 4px" }}>Message</Text>
                <TextInput value={note} onChange={setNote} />

                <KittycordFriendsRoster
                    phase={phase}
                    friends={friends}
                    reload={reload}
                    onStopDiscoverable={stopDiscoverable}
                    renderActions={user => (
                        <button className="kc-fr-btn kc-fr-btn-primary" onClick={() => sendTo(user)}>Send</button>
                    )}
                />
            </ModalContent>
        </ModalRoot>
    );
}

export default definePlugin({
    name: "ShareSetup",
    description: "Send your Kittycord plugins, themes and settings to a friend in one click. They get a one-tap import card right in the DM.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Utility"],
    dependencies: ["MessageAccessoriesAPI", "ContextMenuAPI"],
    settings,

    toolboxActions: {
        "Share setup with a friend"() {
            openModal(props => <FriendsModal rootProps={props} />);
        },
        "Open Kittycord friends"() {
            openModal(props => <FriendsListModal rootProps={props} />);
        }
    },

    contextMenus: {
        "user-context"(children, { user }: { user?: User; }) {
            if (!user || user.bot || !RelationshipStore.isFriend(user.id)) return;
            children.push(
                <Menu.MenuItem
                    id="vc-sharesetup-send"
                    label="Send my Kittycord setup…"
                    action={() => openModal(props => <SendModal rootProps={props} user={user} />)}
                />
            );
        }
    },

    renderMessageAccessory({ message }) {
        const attachment = findShareAttachment(message.attachments);
        if (!attachment) return null;
        const own = message.author?.id === UserStore.getCurrentUser()?.id;
        return <ImportCard message={message} attachment={attachment} own={own} />;
    },

    async start() {
        enableStyle(style);
        SettingsPlugin.customEntries.push({
            key: "kittycord_friends",
            title: "Kittycord Friends",
            panelTitle: "Kittycord Friends",
            Component: KittycordFriendsTab,
            Icon: UserIcon,
            pinned: true
        });
        try {
            const { consent } = await getShareConsent();
            if (consent !== false) await enableFriendDiscovery();
        } catch (e) {
            logger.error("friend discovery init failed", e);
        }
    },

    stop() {
        removeFromArray(SettingsPlugin.customEntries, e => e.key === "kittycord_friends");
        disableStyle(style);
    }
});
