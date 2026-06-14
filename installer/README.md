# Kittycord Windows Installer

There are two installers:

| Script | For whom | What it does |
|---|---|---|
| `Kittycord-Installer-GUI.ps1` | **End users** (compiled to `Kittycord-Installer.exe` by CI) | Graphical installer: downloads the latest `desktop.asar` from GitHub Releases and patches Discord. No repo/pnpm needed. |
| `Kittycord-Online-Install.ps1` | **End users (console)** | Same job as the GUI, as a plain console script. |
| `Kittycord-Install.ps1` | **Developers** | Patches Discord to load your local `dist/desktop` build (run `pnpm build` first). |

`Kittycord-Uninstall.ps1` reverts any of them.

## System requirements

- **Windows 10 (version 1803 or newer) or Windows 11.** Everything the installer needs — .NET
  Framework, Windows PowerShell and `curl` — is already built into these, so there's **nothing
  extra to install**.
- **The standard Discord desktop app** from [discord.com](https://discord.com/download), launched
  at least once so it has finished setting up. (The **Microsoft Store** version of Discord can't be
  patched — use the discord.com one.)
- **An internet connection** (the installer downloads the build over HTTPS and verifies it
  against the SHA-256 checksum published with each release).
- Administrator is **not required**. Running as your normal user is recommended (elevation can
  affect Discord's file permissions), but the installer no longer blocks it — it just warns.
- On first launch, Windows SmartScreen may show "Windows protected your PC" because the `.exe` is
  unsigned — click **"More info" → "Run anyway"**. Some antivirus may flag it for the same reason
  (it's a PowerShell installer that downloads from GitHub); allow it / add an exclusion if needed.

The installer checks these for you and shows a clear message if something's missing (Discord not
installed, not launched yet, Store version, or no internet).

## Easiest: prebuilt `.exe`

![Kittycord Installer](preview.png)

Download **`Kittycord-Installer.exe`** from the
[latest release](https://github.com/KittyCord-Production/Kittycord/releases/latest), run it (Administrator is
not needed), pick your Discord install and click **Install**, then start Discord. The graphical installer
downloads the latest build and patches Discord (and cleanly takes over an install that another mod
patched). It is produced automatically by [.github/workflows/release.yml](../.github/workflows/release.yml).

> The `.exe` is unsigned, so Windows SmartScreen may warn on first run — choose
> "More info" → "Run anyway".

## Developer install (from source)

1. Build Kittycord once so the output exists:
   ```powershell
   pnpm install
   pnpm build
   ```
2. Run the installer (do **not** use an Administrator terminal):
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\installer\Kittycord-Install.ps1
   ```
3. Start Discord again. You should see the Kittycord settings section.

It patches Discord Stable, PTB and Canary if found, backing up the original `app.asar` as
`_app.asar` and injecting an `app/` folder that loads `dist/desktop/patcher.js` (with an automatic
fallback to vanilla Discord if the patcher ever fails to load).

## Uninstall

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\Kittycord-Uninstall.ps1
```

This removes the injected `app/` folder and restores the original `app.asar`.

## Notes

- The injected `index.js` references the **absolute path** of this repo's `dist/desktop`. If you
  move the repo, re-run the installer.
- Discord host updates create a new `app-<version>` folder; re-run the installer after a Discord
  update if Kittycord stops loading (a host-update hook handles most cases automatically).
- A standalone, double-clickable installer and a custom client are on the roadmap.
