# Store listing: Kittycord browser extension

Copy for the Chrome Web Store and Firefox Add-ons listings, plus the answers reviewers ask for.
Everything below describes the browser build (`extension-chrome.zip`, `extension-firefox.zip`),
not the desktop installer.

---

## Short description

Chrome Web Store limit is 132 characters. This one is 117.

> Adds plugins, themes and custom CSS to Discord in your browser. Hundreds of features, every one a toggle you control.

---

## Full description

> Kittycord turns discord.com into something you can actually shape. It adds a settings section of
> its own where hundreds of small features sit behind switches, and a theme engine that restyles
> the whole client.
>
> **Plugins.** More than 400 of them ship with the extension, covering chat, appearance, voice,
> moderation and everyday utilities. Nothing extra to download, nothing to compile. Read what each
> one does, flip it on, flip it off again if you don't like it.
>
> **Themes and QuickCSS.** Load a theme from a link, or write your own CSS in the built-in editor
> and watch it apply as you type. Kittycord Studio lets you build a theme with a visual editor
> instead of writing CSS by hand.
>
> **Made to be reversible.** Every feature is off by default until you turn it on, and your
> settings live in your own browser. Uninstall the extension and Discord is exactly as it was.
>
> **Open source.** The full source is on GitHub under GPL-3.0, and every release is built from it
> automatically. You can read every line that runs on your machine.
>
> Kittycord works on discord.com in the browser. There is a desktop version for the Discord app as
> well, with the same plugins and themes.
>
> Kittycord is an independent project. It is not made by, affiliated with or endorsed by Discord
> Inc. Client modifications are against Discord's Terms of Service; use it with that in mind.
>
> Source, releases and issue tracker: https://github.com/KittyCord-Production/Kittycord

---

## Category

- **Chrome Web Store:** Social & Communication
- **Firefox Add-ons:** Social & Communication (secondary: Appearance)

---

## Privacy policy URL

`https://kittycord.dev/privacy`

Use this URL in both dashboards. It must stay in step with `PRIVACY_POLICY.md` in the repository.

---

## Permission justification

Reviewer-facing wording. One entry per permission that the store asks about.

### Host permission: `*://*.discord.com/*`

Kittycord only does anything on Discord. The extension injects its content scripts into
discord.com so it can add its settings section, its plugins and its theme engine to the page. It
does not run on any other site, and the content scripts only match `*://*.discord.com/*`.

### Host permission: `https://raw.githubusercontent.com/*`

The overwhelming majority of user-made Discord themes are plain `.css` files hosted on GitHub.
GitHub serves them as `text/plain`, which browsers refuse to apply as a stylesheet, so the
extension rewrites the `Content-Type` response header to `text/css` for stylesheet requests to
that host. It reads nothing else from GitHub and sends nothing to it.

### `declarativeNetRequest` (Chrome, MV3)

Used for exactly two static rules, both shipped inside the package as
`modifyResponseHeaders.json`. There are no dynamic rules, no request blocking and no access to
request or response bodies.

1. Remove the `Content-Security-Policy` and `Content-Security-Policy-Report-Only` response headers
   on Discord document loads. This is the core of the extension: Discord's CSP forbids loading
   stylesheets, fonts and images from anywhere else, so without this rewrite a user's own theme or
   plugin cannot load its own assets and the extension has nothing to offer. The rule is scoped to
   `||discord.com^` and to `main_frame` / `sub_frame` only.
2. Set `Content-Type: text/css` on stylesheet responses from `raw.githubusercontent.com`, as
   explained above.

### `webRequest` + `webRequestBlocking` (Firefox, MV2)

The same two header rewrites. Manifest V2 has no `declarativeNetRequest`, so the only way to edit
a response header is a blocking `onHeadersReceived` listener. The listener is registered for two
URL patterns (`*://*.discord.com/*` and `https://raw.githubusercontent.com/*`) and two resource
types (`main_frame`, `stylesheet`). It edits response headers and returns them. It never reads,
blocks, redirects or modifies request bodies, and it never inspects traffic to any other site.

### `commands` (Chrome, MV3)

Optional keyboard shortcuts for actions the user already has in Discord: mute, deafen, toggle
voice activity, streamer mode, screen share, navigate back and forward, save a clip. The service
worker receives the shortcut and forwards it to the content script on the active tab. It reads no
tab URLs or titles, so no `tabs` permission is requested.

### Data use

- The extension collects and transmits nothing. The optional usage stats, crash reporting and
  friend discovery in the desktop app have no counterpart in the browser build: those code paths
  are stubbed out and cannot make a request.
- Settings, themes and QuickCSS are stored in the browser's own local storage on the user's
  machine.
- Themes are fetched from URLs the user enters. That is the only outbound traffic the extension
  causes on its own.
- The extension package contains all of its own JavaScript, including the bundled code editor.
  Remotely hosted content is limited to CSS that the user chooses to load.

---

## Screenshot shot list

Five screenshots, 1280x800, PNG, captured on discord.com at 100% zoom in a maximized window with
the browser chrome cropped out. Use a throwaway account and a test server. No real usernames,
avatars, DMs or message content in frame. Use the same dark theme in all five so the set looks
like one product.

1. **The plugin list.** Kittycord's settings section open on Plugins, search empty, so the count
   and the card grid are both visible. Hover one card so a switch reads as interactive. This is
   the first screenshot people see, so it has to say "hundreds of features, all toggles" without a
   caption.
2. **A plugin doing something.** One clearly visible feature in the actual chat view, not in
   settings. A message with an added button or decoration reads better than an abstract setting.
   Crop tight enough that the effect is obvious at thumbnail size.
3. **QuickCSS editor.** The built-in editor open with a short, readable snippet, and the change it
   makes visible in the client behind or beside it. Split the frame so cause and effect are in one
   picture.
4. **Themes.** The theme gallery or theme list, with two or three thumbnails and one theme applied
   to the client around it.
5. **Settings and privacy.** The Privacy & Security panel, showing the request log and the
   switches. This is the screenshot a reviewer looks at, and it answers "what does this thing send"
   before anyone has to ask.

Optional sixth for the Firefox listing: the keyboard shortcut settings, since shortcuts are the
one feature that is hard to photograph anywhere else.

---

## Other listing fields

- **Name:** Kittycord
- **Homepage:** https://kittycord.dev
- **Support site / issue tracker:** https://github.com/KittyCord-Production/Kittycord/issues
- **License:** GPL-3.0-or-later
- **Icon:** `browser/icon.png` (square, transparent background, readable at 16px)
