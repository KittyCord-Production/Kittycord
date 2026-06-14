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
```
