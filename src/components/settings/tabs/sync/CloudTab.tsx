/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2023 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { DEFAULT_CLOUD_URL, useSettings } from "@api/Settings";
import { authorizeCloud, deauthorizeCloud } from "@api/SettingsSync/cloudSetup";
import { deleteCloudSettings, eraseAllCloudData, getCloudSettings, putCloudSettings } from "@api/SettingsSync/cloudSync";
import { Button } from "@components/Button";
import { CheckedTextInput } from "@components/CheckedTextInput";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { CloudDownloadIcon, CloudUploadIcon, SkullIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { localStorage } from "@utils/localStorage";
import { Margins } from "@utils/margins";
import { useForceUpdater } from "@utils/react";
import { findComponentByCodeLazy } from "@webpack";
import { Alerts, SearchableSelect, Select, useState } from "@webpack/common";

const ICON_STYLE: React.CSSProperties = { width: 20, height: 20, borderRadius: 4, verticalAlign: "middle" };

function CloudIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={ICON_STYLE} aria-hidden="true">
            <path d="M6.5 19a4.5 4.5 0 0 1-.42-8.98A6 6 0 0 1 17.7 9.2 4.5 4.5 0 0 1 17.5 19h-11Z" />
        </svg>
    );
}

const RefreshIcon = findComponentByCodeLazy("M4 12a8 8 0 0 1 14.93-4H15");
const TrashIcon = findComponentByCodeLazy("2.81h8.36a3");

function validateUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch {
        return "Invalid URL";
    }
}

const CUSTOM_BACKEND = "custom";

const cloudBackendOptions = [
    { label: "Kittycord Cloud", value: DEFAULT_CLOUD_URL },
    { label: "Self-hosted", value: CUSTOM_BACKEND }
];

const syncDirectionOptions = [
    { label: "Two-way sync (changes go both directions)", value: "both" },
    { label: "This device is the source (upload only)", value: "push" },
    { label: "The cloud is the source (download only)", value: "pull" },
    { label: "Do not sync automatically (manual sync via buttons below only)", value: "manual" }
];

function CloudTab() {
    const settings = useSettings(["cloud.authenticated", "cloud.url", "cloud.settingsSync"]);
    const [inputKey, setInputKey] = useState(0);
    const forceUpdate = useForceUpdater();

    const { cloud } = settings;
    const isAuthenticated = cloud.authenticated;
    const syncEnabled = isAuthenticated && cloud.settingsSync;

    const [isSelfHosted, setIsSelfHosted] = useState(cloud.url !== DEFAULT_CLOUD_URL);

    async function changeUrl(url: string) {
        if (url === CUSTOM_BACKEND) {
            setIsSelfHosted(true);
            return;
        }

        setIsSelfHosted(false);
        cloud.url = url;
        cloud.authenticated = false;

        await deauthorizeCloud();
        await authorizeCloud();

        setInputKey(prev => prev + 1);
    }

    return (
        <SettingsTab>
            <Heading className={Margins.top16}>Cloud Integration</Heading>
            <Paragraph className={Margins.bottom16}>
                Kittycord's cloud integration allows you to sync your settings across multiple devices and Discord installations. Your data is securely stored and can be easily restored at any time.
            </Paragraph>

            <Notice.Info className={Margins.bottom16}>
                Your settings are stored on Kittycord's own cloud. We only ever store your settings and themes, never your
                Discord login or your messages, and you can erase everything again at any time below. Prefer your own server? Pick Self-hosted.
            </Notice.Info>

            <FormSwitch
                title="Enable Cloud Integration"
                description="Connect to the cloud backend for settings synchronization. This will request authorization if you haven't set up cloud integration yet."
                value={isAuthenticated}
                onChange={v => {
                    if (v)
                        authorizeCloud();
                    else
                        cloud.authenticated = v;
                }}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Cloud Backend</Heading>
            <Paragraph className={Margins.bottom16}>
                Choose which cloud backend to use for storing your settings. You can switch between the available cloud backends, or use a self-hosted instance.
            </Paragraph>

            <div className={Margins.bottom8}>
                <SearchableSelect
                    options={cloudBackendOptions}
                    value={isSelfHosted ? CUSTOM_BACKEND : DEFAULT_CLOUD_URL}
                    onChange={v => changeUrl(v)}
                    closeOnSelect={true}
                    renderOptionPrefix={() => <CloudIcon />}
                />
            </div>

            <Flex gap="8px" alignItems="center">
                {isSelfHosted && (
                    <div style={{ flex: 1 }}>
                        <CheckedTextInput
                            key={`backendUrl-${inputKey}`}
                            initialValue={cloud.url}
                            onChange={async v => {
                                cloud.url = v;
                                cloud.authenticated = false;
                                await deauthorizeCloud();
                            }}
                            validate={validateUrl}
                        />
                    </div>
                )}
                <Button
                    disabled={!isAuthenticated}
                    onClick={async () => {
                        cloud.authenticated = false;
                        await deauthorizeCloud();
                        await authorizeCloud();
                    }}
                >
                    <Flex gap="8px" alignItems="center">
                        <RefreshIcon color="currentColor" />
                        Reauthorize
                    </Flex>
                </Button>
            </Flex>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Settings Sync</Heading>
            <Paragraph className={Margins.bottom16}>
                Synchronize your Kittycord settings to the cloud. This makes it easy to keep your configuration consistent across multiple devices without manual import/export.
            </Paragraph>

            <FormSwitch
                title="Enable Settings Sync"
                description="When enabled, your settings can be synced to and from the cloud. Use the actions below to manually sync."
                value={cloud.settingsSync}
                onChange={v => { cloud.settingsSync = v; }}
                disabled={!isAuthenticated}
                hideBorder
            />

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Sync Rules for This Device</Heading>
            <Paragraph className={Margins.bottom16}>
                This setting controls how settings move between <strong>this device</strong> and the cloud. You can let changes flow both ways, or choose one place to be the main source of truth.
            </Paragraph>

            <Select
                options={syncDirectionOptions}
                isSelected={v => v === (localStorage.Vencord_cloudSyncDirection ?? "both")}
                select={v => {
                    localStorage.Vencord_cloudSyncDirection = v;
                    forceUpdate();
                }}
                serialize={v => v}
                isDisabled={!syncEnabled}
            />

            <Flex gap="8px" className={Margins.top16}>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => putCloudSettings(true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudUploadIcon />
                        Sync to Cloud
                    </Flex>
                </Button>
                <Button
                    style={{ flex: 1 }}
                    disabled={!syncEnabled}
                    onClick={() => getCloudSettings(true, true)}
                >
                    <Flex gap="8px" alignItems="center">
                        <CloudDownloadIcon />
                        Sync from Cloud
                    </Flex>
                </Button>
            </Flex>

            {!isAuthenticated && (
                <Notice.Warning className={Margins.top8}>
                    Enable cloud integration above to use settings sync features.
                </Notice.Warning>
            )}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Danger Zone</Heading>
            <Paragraph className={Margins.bottom16}>
                Permanently delete all your data from the cloud. This action cannot be undone and will remove all synced settings and any other data stored on the cloud backend.
            </Paragraph>

            <Flex gap="8px">
                <Button
                    variant="dangerPrimary"
                    size="medium"
                    disabled={!syncEnabled}
                    onClick={() => deleteCloudSettings()}
                >
                    <Flex gap="8px" alignItems="center">
                        <TrashIcon color="currentColor" />
                        Delete Cloud Settings
                    </Flex>
                </Button>
                <Button
                    variant="dangerSecondary"
                    size="medium"
                    disabled={!isAuthenticated}
                    onClick={() => Alerts.show({
                        title: "Delete Cloud Account",
                        body: "Are you sure you want to permanently delete your cloud account and all associated data? This action cannot be undone.",
                        onConfirm: eraseAllCloudData,
                        confirmText: "Delete Account",
                        confirmColor: "vc-cloud-erase-data-danger-btn",
                        cancelText: "Cancel"
                    })}
                >
                    <Flex gap="8px" alignItems="center">
                        <SkullIcon />
                        Delete Cloud Account
                    </Flex>
                </Button>
            </Flex>
        </SettingsTab>
    );
}

export default wrapTab(CloudTab, "Cloud");
