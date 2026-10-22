/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as DataStore from "@api/DataStore";
import { BRAND_API } from "@branding";
import { Logger } from "@utils/Logger";
import { OAuth2AuthorizeModal, openModal, showToast, UserStore } from "@webpack/common";

const logger = new Logger("KittycordLogin");
const SECRET_STORE = "Vencord_cloudSecret";

let pendingLogin: Promise<string | null> | null = null;

const secretKey = (userId: string) => `${new URL(BRAND_API).origin}:${userId}`;

async function login(userId: string): Promise<string | null> {
    let clientId: string;
    let redirectUri: string;
    try {
        ({ clientId, redirectUri } = await (await fetch(`${BRAND_API}/v1/oauth/settings`)).json());
    } catch {
        showToast({ text: "Could not reach the Kittycord server. Try again in a moment.", variant: "critical" });
        return null;
    }

    return new Promise(resolve => {
        let started = false;
        openModal(props => (
            <OAuth2AuthorizeModal
                {...props}
                scopes={["identify"]}
                responseType="code"
                redirectUri={redirectUri}
                permissions={0n}
                clientId={clientId}
                cancelCompletesFlow={false}
                callback={async ({ location }: { location?: string; }) => {
                    started = true;
                    if (!location) return resolve(null);
                    try {
                        const { secret } = await (await fetch(location, { headers: { Accept: "application/json" } })).json();
                        if (typeof secret !== "string") throw new Error("No secret returned");
                        await DataStore.update<Record<string, string>>(SECRET_STORE, s => ({ ...s, [secretKey(userId)]: secret }));
                        resolve(secret);
                    } catch (e) {
                        logger.error("Login failed", e);
                        showToast({ text: "Discord login failed. Please try again.", variant: "critical" });
                        resolve(null);
                    }
                }}
            />
        ), {
            onCloseCallback() {
                if (!started) resolve(null);
            }
        });
    });
}

export async function getKittyAuth(prompt = true): Promise<string | null> {
    const me = UserStore.getCurrentUser();
    if (!me) return null;
    let secret = (await DataStore.get<Record<string, string>>(SECRET_STORE))?.[secretKey(me.id)] ?? null;
    if (!secret && prompt) {
        pendingLogin ??= login(me.id).finally(() => pendingLogin = null);
        secret = await pendingLogin;
    }
    return secret ? btoa(`${secret}:${me.id}`) : null;
}
