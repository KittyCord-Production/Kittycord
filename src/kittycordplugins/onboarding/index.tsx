/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { get, set } from "@api/DataStore";
import { showNotification } from "@api/Notifications";
import { isPluginEnabled, pluginRequiresRestart, plugins, startPlugin } from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { parseUrl } from "@utils/misc";
import { ModalCloseButton as ModalCloseButtonRaw, ModalContent as ModalContentRaw, ModalHeader as ModalHeaderRaw, ModalRoot as ModalRootRaw, ModalSize, openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import definePlugin, { type PluginNative } from "@utils/types";
import { Button, React, showToast, Text, TextInput, Toasts, UserStore } from "@webpack/common";
import type { ComponentType } from "react";

import { BRAND_WEBSITE } from "../../branding";
import { type FriendAction, friendConsumed, markFriendConsumed, ONBOARDING_SEEN_KEY as SEEN_KEY, subscribeFriendAction, takeFriendAction } from "../_shared/friendLink";
import { applyGalleryThemeById } from "../kittycordStudio/store";
import { applyShare, parseEnvelope, type ShareEnvelope } from "../shareSetup/utils";

// The @utils/modal components are intentionally typed `never` (deprecated). Cast them so we can use them as JSX.
const ModalRoot = ModalRootRaw as ComponentType<any>;
const ModalHeader = ModalHeaderRaw as ComponentType<any>;
const ModalContent = ModalContentRaw as ComponentType<any>;
const ModalCloseButton = ModalCloseButtonRaw as ComponentType<any>;

const CODE_RE = /^[a-z0-9_-]{3,20}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseFriendInput(raw: string): FriendAction | null {
    const s = raw.trim();
    if (!s) return null;
    const url = parseUrl(s);
    if (url) {
        const id = url.searchParams.get("id");
        if (id && UUID_RE.test(id)) return { kind: "theme", value: id };
        const code = url.searchParams.get("code");
        if (code && CODE_RE.test(code.toLowerCase())) return { kind: "claim", value: code.toLowerCase() };
        return null;
    }
    return CODE_RE.test(s.toLowerCase()) ? { kind: "claim", value: s.toLowerCase() } : null;
}

const InvitesNative = VencordNative?.pluginHelpers?.KittyInvites as PluginNative<typeof import("../kittyInvites/native")> | undefined;

interface Pack {
    id: string;
    title: string;
    description: string;
    plugins: string[];
    default: boolean;
}

const PACKS: Pack[] = [
    { id: "essentials", title: "Kittycord essentials", description: "Modes, sharing your setup with friends, and private bookmarks.", plugins: ["Modes", "ShareSetup", "Bookmarks"], default: true },
    { id: "calm", title: "Calm & performance", description: "Quiet hours for your status, and a lighter, smoother Discord.", plugins: ["QuietHours", "PerformanceMode"], default: true },
    { id: "organise", title: "Organise", description: "Tag messages with private labels and tuck chat-bar buttons away.", plugins: ["MessageTags", "Backpack"], default: false },
    { id: "cute", title: "Cute look", description: "A pink kawaii glass theme, the Kittycord logo on the home button, and a tiny pet cat living in your Discord.", plugins: ["HelloKittyTheme", "KittyLogo", "KittyPet"], default: false }
];

function applyPacks(chosen: Record<string, boolean>): boolean {
    let restartNeeded = false;
    for (const pack of PACKS) {
        if (!chosen[pack.id]) continue;
        for (const name of pack.plugins) {
            const p = plugins[name];
            if (!p || p.required || isPluginEnabled(name)) continue;
            Settings.plugins[name].enabled = true;
            if (pluginRequiresRestart(p)) restartNeeded = true;
            else if (!startPlugin(p)) restartNeeded = true;
        }
    }
    return restartNeeded;
}

function shareSummary(env: ShareEnvelope): string {
    const n = env.enabledPlugins.length;
    if (env.scope === "css") return "themes & QuickCSS";
    if (env.scope === "all") return `${n} plugins, themes & settings`;
    return `${n} plugins & their settings`;
}

function OnboardingModal({ rootProps }: { rootProps: any; }) {
    const [chosen, setChosen] = React.useState<Record<string, boolean>>(
        Object.fromEntries(PACKS.map(p => [p.id, p.default] as [string, boolean]))
    );
    const [refCode, setRefCode] = React.useState("");
    const [refState, setRefState] = React.useState<"idle" | "saving" | "done" | "fail">("idle");
    const fileRef = React.useRef<HTMLInputElement>(null);
    const [pending, setPending] = React.useState<ShareEnvelope | null>(null);
    const [importDone, setImportDone] = React.useState(false);
    const [friend, setFriend] = React.useState<FriendAction | null>(takeFriendAction);

    React.useEffect(() => subscribeFriendAction(setFriend), []);

    async function runFriendAction(action: FriendAction): Promise<boolean> {
        if (friendConsumed(action)) return true;
        if (action.kind === "theme") {
            const theme = await applyGalleryThemeById(action.value);
            if (!theme) return false;
            markFriendConsumed(action);
            showToast(`"${theme.name}" applied. 🎨`, Toasts.Type.SUCCESS);
            return true;
        }
        const me = UserStore.getCurrentUser();
        if (!InvitesNative || !me) return false;
        const status = await InvitesNative.claim(me.id, action.value);
        if (status !== "ok") return false;
        markFriendConsumed(action);
        showToast("Thanks, your inviter just got the credit! 🐱", Toasts.Type.SUCCESS);
        return true;
    }

    async function confirmFriend() {
        if (!friend) return;
        const action = friend;
        setFriend(null);
        if (!await runFriendAction(action)) showToast("Couldn't start from your friend just now. Try their code or link below.", Toasts.Type.FAILURE);
    }

    async function claimReferral() {
        const action = parseFriendInput(refCode);
        if (!action) { setRefState("fail"); return; }
        setRefState("saving");
        setRefState(await runFriendAction(action) ? "done" : "fail");
    }

    async function onPickFile() {
        const file = fileRef.current?.files?.[0];
        if (fileRef.current) fileRef.current.value = "";
        if (!file) return;
        try {
            setPending(parseEnvelope(await file.text()));
        } catch (e) {
            showToast(String((e as Error)?.message ?? "That isn't a Kittycord setup file."), Toasts.Type.FAILURE);
        }
    }

    async function importFriendSetup() {
        if (!pending) return;
        try {
            await applyShare(pending);
            set(SEEN_KEY, true);
            setPending(null);
            setImportDone(true);
            showNotification({
                title: "Setup imported — restart to finish",
                body: "Click here to restart Discord now.",
                onClick: () => (IS_WEB ? location.reload() : relaunch())
            });
        } catch (e) {
            showToast(String((e as Error)?.message ?? "Import failed."), Toasts.Type.FAILURE);
        }
    }

    function finish(apply: boolean) {
        set(SEEN_KEY, true);
        if (apply) {
            const restartNeeded = applyPacks(chosen);
            showToast("You're all set.", Toasts.Type.SUCCESS);
            if (restartNeeded) {
                showNotification({
                    title: "Almost done — restart to finish",
                    body: "Some of what you picked needs a restart. Click here to restart now.",
                    onClick: () => (IS_WEB ? location.reload() : relaunch())
                });
            }
        }
        rootProps.onClose();
    }

    return (
        <ModalRoot {...rootProps} size={ModalSize.MEDIUM}>
            <ModalHeader>
                <Text variant="heading-lg/semibold" style={{ flexGrow: 1 }}>Welcome to Kittycord 🐱</Text>
                <ModalCloseButton onClick={() => finish(false)} />
            </ModalHeader>
            <ModalContent>
                <Text variant="text-md/normal" style={{ margin: "12px 0" }}>
                    Pick what you'd like turned on. You can change any of this later in Settings → Plugins.
                </Text>

                {PACKS.map(pack => (
                    <FormSwitch
                        key={pack.id}
                        title={pack.title}
                        description={pack.description}
                        value={chosen[pack.id]}
                        onChange={v => setChosen(c => ({ ...c, [pack.id]: v }))}
                    />
                ))}

                <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "12px 0" }}>
                    Tip: click the Kittycord button in the channel header for Modes, bookmarks, tags and “Share setup with a friend”.
                </Text>

                {friend && (
                    <div style={{ margin: "4px 0 12px" }}>
                        <Text variant="text-md/semibold">Start from a friend 🐱</Text>
                        <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "2px 0 6px" }}>
                            {friend.kind === "theme"
                                ? "A friend shared their Kittycord theme with you. Apply it to start with their look."
                                : "A friend invited you. Confirm so it counts for them."}
                        </Text>
                        <Flex style={{ gap: 8 }}>
                            <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} onClick={confirmFriend}>
                                {friend.kind === "theme" ? "Use their theme" : "Confirm"}
                            </Button>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} size={Button.Sizes.SMALL} onClick={() => setFriend(null)}>Skip</Button>
                        </Flex>
                    </div>
                )}

                <div style={{ margin: "4px 0 12px" }}>
                    <Text variant="text-md/semibold">Coming from a friend?</Text>
                    <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "2px 0 6px" }}>
                        If a friend sent you their Kittycord setup file, open it here to start with the same plugins and themes.
                    </Text>
                    {importDone ? (
                        <Text variant="text-sm/normal" style={{ color: "var(--text-positive)" }}>Imported — restart to finish. 🐱</Text>
                    ) : pending ? (
                        <Flex style={{ gap: 8, alignItems: "center" }}>
                            <Text variant="text-sm/normal" style={{ flexGrow: 1 }}>
                                Found {pending.sender.username || "a friend"}'s setup — {shareSummary(pending)}.
                            </Text>
                            <Button color={Button.Colors.BRAND} size={Button.Sizes.SMALL} onClick={importFriendSetup}>Import</Button>
                            <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} size={Button.Sizes.SMALL} onClick={() => setPending(null)}>Cancel</Button>
                        </Flex>
                    ) : (
                        <Button color={Button.Colors.PRIMARY} size={Button.Sizes.SMALL} onClick={() => fileRef.current?.click()}>
                            Choose setup file…
                        </Button>
                    )}
                    <input ref={fileRef} type="file" accept=".kcshare,application/json" style={{ display: "none" }} onChange={onPickFile} />
                </div>

                {InvitesNative && (
                    <div style={{ margin: "4px 0 12px" }}>
                        <Text variant="text-md/semibold">Have a friend's code or link?</Text>
                        <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "2px 0 6px" }}>
                            Paste a friend's creator code or a kittycord.dev share link to start where they did.
                        </Text>
                        {refState === "done" ? (
                            <Text variant="text-sm/normal" style={{ color: "var(--text-positive)" }}>Done, thanks! 🐱</Text>
                        ) : (
                            <Flex style={{ gap: 8 }}>
                                <div style={{ flexGrow: 1 }}>
                                    <TextInput value={refCode} onChange={setRefCode} placeholder="their code or share link" maxLength={200} />
                                </div>
                                <Button color={Button.Colors.BRAND} disabled={refState === "saving" || !refCode.trim()} onClick={claimReferral}>Go</Button>
                            </Flex>
                        )}
                        {refState === "fail" && (
                            <Text variant="text-sm/normal" style={{ color: "var(--text-danger)", marginTop: 4 }}>That didn't work. Check the code or link and try again.</Text>
                        )}
                    </div>
                )}

                <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "0 0 4px" }}>
                    Everything you turn on here can be changed later: click the cat icon in the channel header and pick
                    Kittycord settings.
                </Text>

                <Text variant="text-sm/normal" style={{ opacity: 0.75, margin: "0 0 4px" }}>
                    New here? Find guides and more at{" "}
                    <a role="button" onClick={() => VencordNative.native.openExternal(BRAND_WEBSITE)} style={{ cursor: "pointer", color: "var(--text-link)" }}>kittycord.dev</a>.
                </Text>

                <Flex style={{ gap: 8, justifyContent: "flex-end", margin: "8px 0 16px" }}>
                    <Button look={Button.Looks.LINK} color={Button.Colors.PRIMARY} onClick={() => finish(false)}>Skip</Button>
                    <Button color={Button.Colors.BRAND} onClick={() => finish(true)}>Apply &amp; finish</Button>
                </Flex>
            </ModalContent>
        </ModalRoot>
    );
}

function openOnboarding() {
    openModal(props => <OnboardingModal rootProps={props} />);
}

let timer: ReturnType<typeof setTimeout> | null = null;

export default definePlugin({
    name: "Onboarding",
    description: "A friendly first-run setup that helps you turn on the Kittycord features you want.",
    authors: [{ name: "Kittycord", id: 0n }],
    enabledByDefault: true,

    toolboxActions: {
        "Run setup wizard"() {
            openOnboarding();
        }
    },

    async start() {
        if (await get(SEEN_KEY)) return;
        timer = setTimeout(openOnboarding, 4000);
    },

    stop() {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    }
});
