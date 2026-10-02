/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BaseText } from "@components/BaseText";
import { Paragraph } from "@components/Paragraph";
import { parseBadgeLink } from "@shared/badgeLink";
import { openModal } from "@utils/modal";
import type { RenderModalProps } from "@vencord/discord-types";
import { Modal } from "@webpack/common";

function LinkWarningModal({ modalProps, url }: { modalProps: RenderModalProps; url: URL; }) {
    const lookalike = url.hostname.split(".").some(part => part.startsWith("xn--"));

    return (
        <Modal
            {...modalProps}
            size="sm"
            title="Leave Discord?"
            subtitle="This link was added by the badge owner"
            actions={[
                { text: "Stay safe", variant: "primary", onClick: modalProps.onClose },
                {
                    text: "Open anyway",
                    variant: "secondary",
                    onClick: () => {
                        modalProps.onClose();
                        VencordNative.native.openExternal(url.href);
                    }
                }
            ]}
        >
            <BaseText size="lg" weight="semibold" style={{ wordBreak: "break-all", marginBottom: 4 }}>{url.hostname}</BaseText>
            <Paragraph style={{ wordBreak: "break-all", opacity: 0.8, marginBottom: 12 }}>{url.href}</Paragraph>

            <Paragraph style={{ marginBottom: 8 }}>
                <b>We can't tell whether this website is safe.</b> Kittycord does not check badge links and is not responsible for what is behind them. Please be careful.
            </Paragraph>
            <Paragraph style={{ marginBottom: 8 }}>
                Don't enter passwords or payment details, don't download or run files, and don't scan QR codes unless you trust the site. Nobody from Discord or Kittycord will ever ask you to log in through a badge link.
            </Paragraph>
            {lookalike && (
                <Paragraph style={{ color: "var(--text-danger)" }}>
                    This address uses special characters and may be imitating another website.
                </Paragraph>
            )}
        </Modal>
    );
}

export function openBadgeLink(raw: string | null | undefined) {
    const url = parseBadgeLink(raw);
    if (!url) return;
    openModal(modalProps => <LinkWarningModal modalProps={modalProps} url={url} />);
}
