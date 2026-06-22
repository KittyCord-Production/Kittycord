# Security Policy

Kittycord is a Discord client mod built to be the calmest, cutest and **safest** way to use
Discord. Safety isn't a feature we bolt on — it's the whole point. This document explains how to
report a problem, what Kittycord does and does not touch on your computer, and how to verify that the
build you downloaded is the genuine, untampered one.

Kittycord is fully open source (GPL-3.0-or-later) and every release is built automatically from this
public repository, so nothing here has to be taken on trust — you can check all of it yourself.

## Reporting a vulnerability

If you've found a security issue, please report it privately so it can be fixed before it's made
public:

1. Go to the **Security** tab of this repository and click **Report a vulnerability** (GitHub's
   private advisory form). This keeps the details between you and the maintainers.
2. If you can't use that form, open a regular [issue](https://github.com/KittyCord-Production/Kittycord/issues)
   describing the problem **without** sensitive proof-of-concept details, and mention that it's a
   security report.

Please include what you found, how to reproduce it, and the impact you expect. We aim to acknowledge
reports quickly and will keep you updated as we work on a fix. Thank you for helping keep everyone
safe — responsible disclosure is genuinely appreciated.

## What Kittycord does and doesn't do

Kittycord runs inside your own Discord client. It modifies the look and behaviour of Discord on your
machine; it does **not** talk to Discord on your behalf or touch your account credentials.

**Kittycord never:**

- reads or transmits your Discord login token,
- logs your keystrokes,
- collects or uploads your messages,
- collects your password or your IP address.

**The only things that ever leave your computer do so because you turned them on:**

- anonymous usage stats — a random install ID plus the Kittycord version, at most once a day, so we
  can count active installs (no account, no messages, no personal data);
- any public cosmetics you explicitly choose to show others (for example a name colour, an avatar
  decoration or a creator code).

All of these are opt-in and can be turned off at any time from **Settings → Privacy & Security** and
**Settings → Account Safety** inside the app.

## Verify your download

Every Kittycord release is built by GitHub Actions directly from this public source — see the
[Actions tab](https://github.com/KittyCord-Production/Kittycord/actions) for the exact run that
produced each build. Nothing is added by hand in between.

To prove the file you downloaded matches that build, every release ships a SHA-256 checksum next to
each file:

| File | Checksum file |
|------|---------------|
| `Kittycord-Installer.exe` | `Kittycord-Installer.exe.sha256` |
| `desktop.asar` | `desktop.asar.sha256` |
| `equibop.asar` | `equibop.asar.sha256` |

**On Windows (PowerShell):**

```powershell
Get-FileHash .\Kittycord-Installer.exe -Algorithm SHA256
```

Compare the printed hash with the contents of `Kittycord-Installer.exe.sha256` from the
[latest release](https://github.com/KittyCord-Production/Kittycord/releases/latest). They should match
(hashes are case-insensitive). If they don't, **do not run the file** — re-download it from the
official release page, and if it still doesn't match, report it.

## Why your antivirus might warn

The Windows installer isn't code-signed yet, and it modifies the Discord app on disk. Both of those
trip generic antivirus heuristics, which flag almost every Discord client mod the same way. It's a
false alarm — the steps above let you confirm exactly what runs on your PC. Code-signing is on the
roadmap to remove this friction.

## Supported versions

Kittycord ships a single rolling release tagged `latest`, and the built-in updater keeps you on the
newest build. Always run the latest version — security fixes land there, and only the latest release
is supported.
