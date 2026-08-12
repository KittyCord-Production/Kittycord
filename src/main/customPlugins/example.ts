/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const EXAMPLE_PLUGIN_SOURCE = `/*
 * Example plugin. Copy this file, rename it, and make it your own.
 *
 * Rules of this folder:
 *   - plain .js only, no TypeScript and no JSX
 *   - no import / require, everything comes from the injected \`Kittycord\` object
 *   - reload Discord (Ctrl+R) after every change
 *   - your plugin starts out switched off, turn it on under Settings > Plugins > Show Custom
 *
 * The API lives on \`Kittycord\`:
 *   Kittycord.Webpack         findByPropsLazy, findComponentByCodeLazy, findStoreLazy, ...
 *   Kittycord.Webpack.Common  React, Button, Menu, UserStore, showToast, FluxDispatcher, ...
 *   Kittycord.Api             MessageEvents, Notifications, DataStore, ContextMenu, Settings, ...
 *   Kittycord.Util            Logger, sleep, classes, Margins, openUserProfile, sendMessage, ...
 *   Kittycord.Components      ErrorBoundary, Card, Switch, Heading, ...
 */

module.exports = definePlugin({
    name: "ExamplePlugin",
    description: "Shows a toast whenever you send a message.",
    authors: [{ name: "you", id: 0n }],

    onBeforeMessageSend(channelId, message) {
        if (!message.content) return;
        Kittycord.Webpack.Common.showToast("You said: " + message.content.slice(0, 40));
    }
});

/*
 * Need to run code when the plugin is switched on? Use start and stop instead.
 * Everything start() sets up, stop() has to tear down again.
 *
 * module.exports = definePlugin({
 *     name: "TickPlugin",
 *     description: "Logs a line every ten seconds.",
 *     authors: [{ name: "you", id: 0n }],
 *
 *     start() {
 *         const logger = new Kittycord.Util.Logger("TickPlugin");
 *         this.interval = setInterval(() => logger.info("tick"), 10_000);
 *     },
 *
 *     stop() {
 *         clearInterval(this.interval);
 *     }
 * });
 */
`;
