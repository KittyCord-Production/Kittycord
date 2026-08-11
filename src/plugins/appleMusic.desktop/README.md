# AppleMusicRichPresence

This plugin enables Discord rich presence for your Apple Music! It works on macOS with the Music app and on Windows with the Apple Music app, which needs to be running and playing for anything to show up. Album artwork and the links come from Apple's public catalogue on both platforms.

On Windows the track is read from the same system media session that drives the volume overlay. That is done by a small background PowerShell process, which runs only while the plugin is enabled and closes with it.

![Screenshot of the activity in Discord](https://github.com/Vendicated/Vencord/assets/70191398/1f811090-ab5f-4060-a9ee-d0ac44a1d3c0)

## Configuration

For the customizable activity format strings, you can use several special strings to include track data in activities! `{name}` is replaced with the track name; `{artist}` is replaced with the artist(s)' name(s); and `{album}` is replaced with the album name.
