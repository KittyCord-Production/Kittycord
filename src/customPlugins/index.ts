/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Settings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import { Plugin } from "@utils/types";

import Plugins, { PluginMeta } from "~plugins";

import * as CustomPluginApi from "./api";

const logger = new Logger("CustomPlugins", "#f5a97f");

export interface CustomPluginError {
    fileName: string;
    message: string;
}

export const customPluginErrors: CustomPluginError[] = [];

function evaluate(fileName: string, source: string): Plugin {
    const module = { exports: {} as Plugin };
    let defined: Plugin | undefined;

    const definePlugin = (plugin: Plugin) => {
        defined = plugin;
        return plugin;
    };

    const factory = new Function("Kittycord", "definePlugin", "module", "exports", source);
    factory(CustomPluginApi, definePlugin, module, module.exports);

    return defined ?? module.exports;
}

export function loadCustomPlugins() {
    if (IS_WEB || !Settings.enableCustomPlugins) return;

    for (const { fileName, source } of VencordNative.customPlugins.getAll()) {
        try {
            const plugin = evaluate(fileName, source);

            if (typeof plugin?.name !== "string" || !plugin.name) {
                throw new Error("The plugin has no name. Every plugin needs a unique name property.");
            }

            if (plugin.name in Plugins) {
                throw new Error(`A plugin called ${plugin.name} already exists. Give yours a different name.`);
            }

            plugin.description ||= "Custom plugin.";
            plugin.authors ??= [{ name: fileName.replace(/\.js$/, ""), id: 0n }];

            Plugins[plugin.name] = plugin;
            PluginMeta[plugin.name] = { folderName: `custom/${fileName}`, userPlugin: true, customPlugin: true };

            logger.info(`Loaded ${plugin.name} from ${fileName}`);
        } catch (err) {
            const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
            customPluginErrors.push({ fileName, message });
            logger.error(`Failed to load ${fileName}`, err);
        }
    }
}
