# Maintaining Kittycord

Kittycord is a rebranded fork of **Equicord** (which is itself a fork of **Vencord**), with
moggcord's unique plugins layered on top. It is built to stay **mergeable with upstream** so we
keep getting the newest/best plugin versions automatically.

## Git remotes

| Remote     | URL                                          | Purpose                                            |
|------------|----------------------------------------------|----------------------------------------------------|
| `origin`   | https://github.com/KittyCord-Production/Kittycord.git   | Where Kittycord is published                         |
| `equicord` | https://github.com/Equicord/Equicord.git     | Primary upstream (already contains all of Vencord)  |
| `vencord`  | https://github.com/Vendicated/Vencord.git    | Reference / optional direct cherry-picks            |

Publish changes:

```bash
git push origin main
```

> The build reads `git remote get-url origin` for source-code links and the user agent. Until
> `origin` is set it falls back gracefully (see `scripts/build/common.mjs` → `gitRemotePlugin`),
> or you can set `KITTYCORD_REMOTE=<owner>/<repo>` in the environment.

## Staying in sync with upstream

Because Equicord already merges Vencord into itself, syncing from `equicord` transitively brings
Vencord updates too:

```bash
git fetch equicord
git merge equicord/main
```

### Keeping merges clean

The fork is designed to minimise conflicts:

- **Additive changes** (new plugin folders `src/moggcordplugins/`, `src/kittycordplugins/`, new
  flags, new build-glob entries) almost never conflict.
- **Branding lives in one place** — `src/branding.ts`. The few upstream files that reference it
  (`src/utils/Logger.ts`, `src/shared/vencordUserAgent.ts`, …) are the only expected conflict
  spots; resolve by keeping our import.
- **Internal `Vencord*` identifiers are left untouched** (IPC channels, `VencordNative`,
  `VencordStyles`, IndexedDB `VencordData`/`VencordStore`, `Vencord_*` localStorage keys). Do not
  rename these — it breaks plugin compatibility and guarantees painful merges.
- **Kittycord code lives in Kittycord files.** `src/main/kittycord.ts` and `src/kittycordStartup.ts`
  hold the startup work, so `src/main/patcher.ts` and `src/Vencord.ts` only carry a one-line call
  each. Add new startup steps there, not in the inherited entry points.
- **Import through the aliases** — `@branding`, `@kittycordplugins/*`, `@moggcordplugins/*`. A
  relative path from an inherited file breaks whenever upstream moves that file.

### Files deliberately removed

These exist upstream and are intentionally gone here. A merge that touches them produces a
delete/modify conflict; resolve it with `git rm`, do not restore them.

| Path | Why it is gone |
|---|---|
| `misc/install.sh` | Installs a different client mod; Kittycord ships its own installers. |
| `scripts/generateReport.ts` | Its only consumer was a workflow this repo does not have. |
| `src/equicordplugins/scheduledMessages/`, `src/equicordplugins/signature/`, `src/equicordplugins/pendingFriendRequest/` handling | Kittycord ships its own plugin of the same name, so only one was ever reachable. |

## Plugin folder layout

| Folder                  | Source                                   |
|-------------------------|------------------------------------------|
| `src/plugins/`          | Vencord plugins (kept in sync upstream)  |
| `src/equicordplugins/`  | Equicord plugins (kept in sync upstream) |
| `src/moggcordplugins/`  | Plugins ported from moggcord (audited)   |
| `src/kittycordplugins/` | **Our own** original plugins             |

When porting a moggcord plugin, first check whether an equivalent already exists in
`src/plugins/` or `src/equicordplugins/`. Keep the better/newer one — never ship duplicates.

## Build & run

```bash
pnpm install
pnpm build        # desktop (patcher/renderer/preload)
pnpm buildWeb     # browser extension + userscript
pnpm inject       # patch local Discord for testing
pnpm uninject     # revert it
```

Before pushing, run what CI runs:

```bash
pnpm testTsc && pnpm lint && pnpm lint-styles && pnpm lint:intl && pnpm lint:patches
```

The installers have their own tests, which CI runs on every release build:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File installer/test/windows-install.test.ps1
bash installer/test/macos-install.test.sh
```

Both patch a throwaway Discord fixture and never touch a real install. If you change how any
installer writes the shim into Discord, the Windows test compares the bytes against
`src/main/applyHostPatch.ts` and will fail if the three writers drift apart.
