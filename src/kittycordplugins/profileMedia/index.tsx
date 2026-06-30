/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import { CloudDownloadIcon, ImageIcon } from "@components/Icons";
import { openImageModal } from "@utils/discord";
import definePlugin from "@utils/types";
import { User } from "@vencord/discord-types";
import { IconUtils, Menu, showToast, Toasts, UserProfileStore } from "@webpack/common";

function getAvatarUrl(user: User, size: number) {
    return IconUtils.getUserAvatarURL(user, true, size);
}

function getBannerUrl(user: User, size: number) {
    const banner = UserProfileStore.getUserProfile(user.id)?.banner;
    if (!banner) return null;
    return IconUtils.getUserBannerURL({ id: user.id, banner, canAnimate: true, size }) ?? null;
}

function safeName(user: User) {
    return (user.username || user.id).replace(/[^\w.-]+/g, "_");
}

function extFromUrl(url: string) {
    const match = url.split("?")[0].match(/\.(\w+)$/);
    return match ? match[1] : "png";
}

async function downloadImage(url: string, filename: string) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const objectUrl = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(objectUrl);
    } catch {
        showToast("Failed to download image", Toasts.Type.FAILURE);
    }
}

const userContextPatch: NavContextMenuPatchCallback = (children, { user }: { user?: User; }) => {
    if (!user) return;

    const avatarUrl = getAvatarUrl(user, 4096);
    const bannerUrl = getBannerUrl(user, 4096);

    children.push(
        <Menu.MenuGroup>
            <Menu.MenuItem
                id="profile-media-view-avatar"
                label="View Avatar"
                icon={ImageIcon}
                action={() => openImageModal({ url: getAvatarUrl(user, 1024), original: avatarUrl, width: 512, height: 512 })}
            />
            <Menu.MenuItem
                id="profile-media-download-avatar"
                label="Download Avatar"
                icon={CloudDownloadIcon}
                action={() => downloadImage(avatarUrl, `avatar_${safeName(user)}.${extFromUrl(avatarUrl)}`)}
            />
            {bannerUrl && (
                <Menu.MenuItem
                    id="profile-media-view-banner"
                    label="View Banner"
                    icon={ImageIcon}
                    action={() => openImageModal({ url: bannerUrl, original: bannerUrl, width: 1024 })}
                />
            )}
            {bannerUrl && (
                <Menu.MenuItem
                    id="profile-media-download-banner"
                    label="Download Banner"
                    icon={CloudDownloadIcon}
                    action={() => downloadImage(bannerUrl, `banner_${safeName(user)}.${extFromUrl(bannerUrl)}`)}
                />
            )}
        </Menu.MenuGroup>
    );
};

export default definePlugin({
    name: "ProfileMedia",
    description: "View and download user avatars and banners in full resolution from the right-click menu.",
    authors: [{ name: "Kittycord", id: 0n }],
    tags: ["Media", "Appearance"],
    dependencies: ["DynamicImageModalAPI"],
    contextMenus: {
        "user-context": userContextPatch,
        "user-profile-actions": userContextPatch
    }
});
