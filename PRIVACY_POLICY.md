# Privacy Policy

_Last updated: 10 September 2026_

Kittycord is a modification for the Discord client. It runs on your own computer, and nearly
everything it does stays there: your plugins, your themes, your settings and your custom CSS are
files in Kittycord's own folder.

A handful of features do talk to Kittycord's own server at
`https://kittycord-analytics.hell-bullet-hb.workers.dev`. This page lists every one of them, what
it sends, when it sends it and how to switch it off. On the desktop app you can also watch it
happen live under **Settings → Privacy & Security → What Kittycord sent**, which logs every
request Kittycord made and why.

## What Kittycord never sends

Kittycord never sends your Discord login token, your password, your messages or attachments, the
servers and channels you are in, or anything you type. No feature reads them.

Plugins you write or install yourself, and themes you add from a URL, run with the same access
your browser or Discord client has. Kittycord cannot vouch for what those do, so only add code and
themes you trust.

## Anonymous usage stats

**Sends:** a random install ID that Kittycord generates on your computer, plus the short build
hash of your version. Nothing else. The ID is not derived from and not linked to your Discord
account.

**When:** at most once a day, while Discord is running.

**Default:** off. Kittycord asks once, and remembers "No thanks" without asking again.

**Turn it off:** Settings → Privacy & Security → "Share anonymous usage stats", or
Settings → Plugins → UsageStats.

## Crash reports

**Sends:** the error message and the top ten stack frames, your platform (Windows, macOS or
Linux), the build hash, and the name of the Kittycord plugin the error came from if it came from
one.

**When:** only when a Kittycord feature actually errors, at most five times per session, and never
the same error twice.

**Default:** off.

**Turn it off:** Settings → Privacy & Security → "Send anonymous crash reports".

Before a report leaves your computer it is scrubbed: Discord IDs, anything shaped like a token,
your home folder path and email addresses are replaced with placeholders. Crash reporting is
switched off completely in the browser version and in development builds.

## The "Uses Kittycord" badge

**Sends:** your own Discord user ID, so other people running Kittycord see the cat badge on your
profile. It also downloads the list of IDs that badge should appear on, so Kittycord can draw it
for other people.

**When:** once when Discord starts, and the list is refreshed every ten minutes.

**Default:** off. Your ID is only announced once you switch on "Let friends find you on
Kittycord". Until then Kittycord only downloads the list, so you see other people's badges without
appearing in it yourself.

**Turn it off:** Settings → Privacy & Security → "Let friends find you on Kittycord", or switch the
UsesKittycord plugin off to hide the badge entirely.

## Kittycord Friends

**Sends:** your own Discord user ID so friends can find you, and the user IDs from your friend list
when you open the friends screen, so the server can answer which of them use Kittycord.

**When:** your own ID goes out at most once a day; the friend list is only checked while you have
the friends screen open.

**Default:** off. The Kittycord Friends plugin is off to begin with, and even after you switch it
on nothing is sent until you turn discovery on yourself.

**Turn it off:** Settings → Kittycord Friends → "Find which friends use Kittycord". Turning it off
asks the server to delete your entry.

Sending your setup to a friend uploads exactly the plugins, themes or CSS you picked in that
dialog, as a file attached to your own Discord message. Nothing is sent until you press send.

## Cosmetics, galleries and the shop

Name colours, profile badges, avatar decorations, the theme gallery, command packs, invite
rewards and supporter status all live on the same server. Each of them only contacts it when you
use it:

- Looking at a gallery or loading the public list of colours, badges and decorations downloads
  that list. It sends nothing about you.
- Setting a colour, badge or decoration on your own profile sends your Discord user ID together
  with the choice you made, because that is what other people then see. Clearing it removes it
  again.
- Publishing a theme or a command pack uploads what you wrote plus your Discord user ID, so it can
  be shown as yours and so you can delete it later.
- A creator code you entered in the installer is sent once with your Discord user ID to credit the
  creator, then deleted from your computer.

Switching off the plugin that owns a feature stops it contacting the server at all.

## Update checks

The desktop app asks GitHub for the newest release so it can keep itself current. That request
carries no account data. Downloads are checked against a published SHA-256 checksum before they
are applied.

## The browser version

The extension and the userscript have no desktop process, so usage stats, crash reporting and
friend discovery cannot run there and never make a request. Settings live in your browser's local
storage, on your machine. Themes are fetched from the URLs you enter yourself.

## Discord

Kittycord runs inside Discord, so everything you do in Discord is still covered by Discord's own
privacy policy at [discord.com/privacy](https://discord.com/privacy/). Kittycord is not affiliated
with Discord Inc.

## Changes and questions

If any of this changes, this file changes with it, and the date at the top moves. Kittycord's full
source is public, so every claim here can be checked line by line. Questions or something that
looks wrong: open an issue at
[github.com/KittyCord-Production/Kittycord/issues](https://github.com/KittyCord-Production/Kittycord/issues).
