<div align="center">
  <a href="https://github.com/CenturyRV/Kittycord">
    <img src="./browser/logo.png" width="440" alt="Kittycord">
  </a>
  <p><b>The cutest Discord client mod — plugins, themes and a whole lot of pink.</b></p>
</div>

Kittycord is a Discord client modification — a plugin and theme platform that adds hundreds of
features to Discord while keeping it lightweight and privacy-friendly.

### Included Plugins

Kittycord ships with a large built-in plugin library covering chat, appearance, voice, utility
and more, plus its own plugin folder so you can add your own.

## Installing / Uninstalling

**Windows (easiest):** download **`Kittycord-Installer.exe`** from the
[latest release](https://github.com/CenturyRV/Kittycord/releases/latest), run it, pick your
Discord install and click **Install**, then start Discord again. The installer downloads the
latest build and patches your Discord client.

![Kittycord Installer](installer/preview.png)

**Requirements:** Windows 10 (1803+) or 11 — nothing extra to install (.NET, PowerShell and curl
are built in) — the standard Discord app from discord.com (launched once), and an internet
connection. On first run, click **"More info" → "Run anyway"** on the SmartScreen prompt (the exe
is unsigned). See [installer/README.md](installer/README.md) for details.

To uninstall, run the installer again and choose uninstall, or use
[installer/Kittycord-Uninstall.ps1](installer/Kittycord-Uninstall.ps1).

> A standalone Kittycord desktop client and Mac/Linux installers are on the roadmap. On other
> platforms, use the developer build below.

## Developer Build

### Dependencies

[Git](https://git-scm.com/download) and [Node.JS LTS](https://nodejs.dev/en/) are required.

Install `pnpm`:

> :exclamation: This next command may need to be run as admin/root depending on your system, and you may need to close and reopen your terminal for pnpm to be in your PATH.

```shell
npm i -g pnpm
```

> :exclamation: **IMPORTANT** Make sure you aren't using an admin/root terminal from here onwards. It **will** mess up your Discord/Kittycord instance and you **will** most likely have to reinstall.

Clone Kittycord:

```shell
git clone https://github.com/CenturyRV/Kittycord
cd Kittycord
```

Install dependencies:

```shell
pnpm install --frozen-lockfile
```

Build Kittycord:

```shell
pnpm build
```

Inject Kittycord into your desktop client:

```shell
pnpm inject
```

Build Kittycord for web:

```shell
pnpm buildWeb
```

After building Kittycord's web extension, locate the appropriate ZIP file in the `dist` directory and follow your browser’s guide for installing custom extensions, if supported.

Note: The Firefox extension zip requires Firefox for Developers.

## Disclaimer

Discord is a trademark of Discord Inc., and is solely mentioned here for the sake of descriptivity.
Mentioning it does not imply any affiliation with or endorsement by Discord Inc.

<details>
<summary>Using Kittycord violates Discord's terms of service</summary>

Client modifications are against Discord’s Terms of Service.

However, Discord is pretty indifferent about them and there are no known cases of users getting banned for using client mods! So you should generally be fine if you don’t use plugins that implement abusive behaviour. But no worries, all inbuilt plugins are safe to use!

Regardless, if your account is essential to you and getting disabled would be a disaster for you, you should probably not use any client mods (not exclusive to Kittycord), just to be safe.

Additionally, make sure not to post screenshots with Kittycord in a server where you might get banned for it.

</details>
