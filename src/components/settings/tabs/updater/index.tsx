/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
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

import { useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading, HeadingSecondary } from "@components/Heading";
import { Link } from "@components/Link";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab, wrapTab } from "@components/settings/tabs/BaseTab";
import { Margins } from "@utils/margins";
import { useAwaiter } from "@utils/react";
import { getRepo, isNewer, UpdateLogger } from "@utils/updater";
import { React, Select } from "@webpack/common";

import gitHash from "~git-hash";

import { HashLink, Newer, Updatable } from "./Components";

interface CommonProps {
    repo: string;
    repoPending: boolean;
}

function EquibopSection() {
    if (!IS_EQUIBOP) return null;

    const [isEquibopOutdated] = useAwaiter<boolean>(VesktopNative.app.isOutdated, { fallbackValue: false });

    return (
        <Flex className={Margins.bottom20} flexDirection="column" gap="1em">
            <Card variant="brand">
                <HeadingSecondary>Kittycord</HeadingSecondary>
                <Paragraph>This updater keeps Kittycord up to date.</Paragraph>
                <Paragraph className={Margins.top8}>
                    You may also get separate popups to update the Kittycord desktop app. You can grab the <Link href="https://kittycord.dev">latest version</Link> any time.
                </Paragraph>
            </Card>

            {isEquibopOutdated && (
                <Card variant="warning">
                    <HeadingSecondary>Kittycord Outdated</HeadingSecondary>
                    <Flex flexDirection="column" gap="0.5em">
                        <Paragraph>Your version of the Kittycord app is outdated!</Paragraph>
                        <Button variant="link" onClick={() => VesktopNative.app.openUpdater()}>Open Kittycord Updater</Button>
                    </Flex>
                </Card>
            )}
        </Flex>
    );
}

function Updater() {
    const settings = useSettings(["autoUpdate", "autoUpdateNotification", "updateChannel"]);

    const [repo, err, repoPending] = useAwaiter(getRepo, { fallbackValue: "Loading..." });

    React.useEffect(() => {
        if (err)
            UpdateLogger.error("Failed to retrieve repo", err);
    }, [err]);

    const commonProps: CommonProps = {
        repo,
        repoPending
    };

    return (
        <SettingsTab>
            <EquibopSection />
            <Heading className={Margins.top16}>Update Preferences</Heading>
            <Paragraph className={Margins.bottom20}>
                Control how Kittycord keeps itself up to date. You can choose to update automatically in the background or be notified when new updates are available.
            </Paragraph>

            <FormSwitch
                title="Automatically update"
                description="When enabled, Kittycord will automatically download and install updates in the background without asking for confirmation. You'll need to restart Discord to apply the changes."
                value={settings.autoUpdate}
                onChange={(v: boolean) => settings.autoUpdate = v}
                hideBorder
            />
            <FormSwitch
                value={settings.autoUpdateNotification}
                onChange={(v: boolean) => settings.autoUpdateNotification = v}
                title="Get notified when an automatic update completes"
                description="Receive a notification when Kittycord finishes downloading an update in the background, so you know when to restart Discord."
                disabled={!settings.autoUpdate}
                hideBorder
            />

            {IS_STANDALONE && (
                <>
                    <Divider className={Margins.top20} />

                    <Heading className={Margins.top20}>Release Channel</Heading>
                    <Paragraph className={Margins.bottom8}>
                        Stable gets the polished releases. Beta gets new features first, but is more likely to have rough edges. After switching, check for updates below to move to that channel's build.
                    </Paragraph>
                    <Select
                        options={[
                            { label: "Stable", value: "stable" },
                            { label: "Beta (new features first)", value: "beta" }
                        ]}
                        closeOnSelect={true}
                        select={(v: string) => settings.updateChannel = v as "stable" | "beta"}
                        isSelected={(v: string) => v === settings.updateChannel}
                        serialize={(v: string) => v}
                    />
                </>
            )}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Repository</Heading>
            <Paragraph className={Margins.bottom8}>
                This is the GitHub repository where Kittycord fetches updates from.
            </Paragraph>
            <Paragraph color="text-subtle">
                {repoPending
                    ? repo
                    : err
                        ? "Failed to retrieve - check console"
                        : (
                            <Link href={repo}>
                                {repo.split("/").slice(-2).join("/")}
                            </Link>
                        )
                }
                {" "}(<HashLink hash={gitHash} repo={repo} disabled={repoPending} />)
            </Paragraph>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>Updates</Heading>
            {isNewer ? <Newer {...commonProps} /> : <Updatable {...commonProps} />}
        </SettingsTab>
    );
}

export default IS_UPDATER_DISABLED
    ? null
    : wrapTab(Updater, "Updater");
