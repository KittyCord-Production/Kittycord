/*
 * Kittycord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { User } from "@vencord/discord-types";
import { React, RelationshipStore, SearchableSelect, UserStore } from "@webpack/common";

export function FriendPicker({ value, onChange, placeholder = "Pick a friend…" }: {
    value: User | null;
    onChange(user: User | null): void;
    placeholder?: string;
}) {
    const options = React.useMemo(() =>
        RelationshipStore.getFriendIDs()
            .map(id => UserStore.getUser(id))
            .filter((u): u is User => Boolean(u))
            .map(u => ({ label: u.globalName || u.username, value: u.id }))
            .sort((a, b) => a.label.localeCompare(b.label)), []);

    return (
        <SearchableSelect
            options={options}
            value={value?.id}
            placeholder={placeholder}
            maxVisibleItems={6}
            closeOnSelect
            onChange={(id: string) => onChange(UserStore.getUser(id) ?? null)}
        />
    );
}
