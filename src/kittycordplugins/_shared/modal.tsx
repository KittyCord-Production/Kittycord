/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    ModalCloseButton as ModalCloseButtonRaw,
    ModalContent as ModalContentRaw,
    ModalFooter as ModalFooterRaw,
    ModalHeader as ModalHeaderRaw,
    ModalRoot as ModalRootRaw
} from "@utils/modal";
import type { ComponentType, PropsWithChildren } from "react";

interface ModalRootProps extends PropsWithChildren {
    size?: string;
    transitionState?: number;
    className?: string;
    onAnimationEnd?(): void;
}

interface ModalSectionProps extends PropsWithChildren {
    className?: string;
    separator?: boolean;
    direction?: string;
    justify?: string;
    align?: string;
    scrollbarType?: string;
}

interface ModalCloseButtonProps {
    onClick(): void;
    className?: string;
    withCircleBackground?: boolean;
}

export const ModalRoot = ModalRootRaw as ComponentType<ModalRootProps>;
export const ModalHeader = ModalHeaderRaw as ComponentType<ModalSectionProps>;
export const ModalContent = ModalContentRaw as ComponentType<ModalSectionProps>;
export const ModalFooter = ModalFooterRaw as ComponentType<ModalSectionProps>;
export const ModalCloseButton = ModalCloseButtonRaw as ComponentType<ModalCloseButtonProps>;
