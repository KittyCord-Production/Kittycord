/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { type IpcMainInvokeEvent } from "electron";

export function setBackgroundThrottle(e: IpcMainInvokeEvent, allowThrottle: boolean) {
    e.sender.setBackgroundThrottling(allowThrottle);
}
