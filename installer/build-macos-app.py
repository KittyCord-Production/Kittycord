#!/usr/bin/env python3
import argparse
import os
import struct
import sys
import zipfile

ICNS_SLOTS = [
    (b"icp4", 16),
    (b"icp5", 32),
    (b"icp6", 64),
    (b"ic07", 128),
    (b"ic08", 256),
    (b"ic11", 32),
    (b"ic12", 64),
    (b"ic13", 256),
]

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


def read_ico(path):
    data = open(path, "rb").read()
    if len(data) < 6:
        raise SystemExit(f"{path}: not an icon file")
    _, kind, count = struct.unpack("<HHH", data[:6])
    if kind != 1 or count == 0:
        raise SystemExit(f"{path}: not a Windows icon with images")
    images = {}
    offset = 6
    for _ in range(count):
        width, height, _, _, _, _, size, start = struct.unpack("<BBBBHHII", data[offset:offset + 16])
        offset += 16
        blob = data[start:start + size]
        if not blob.startswith(PNG_MAGIC):
            continue
        images[width or 256] = blob
    if not images:
        raise SystemExit(f"{path}: contains no PNG images, cannot build an icns")
    return images


def build_icns(images):
    entries = []
    for slot, size in ICNS_SLOTS:
        blob = images.get(size)
        if blob is None:
            continue
        entries.append(slot + struct.pack(">I", len(blob) + 8) + blob)
    if not entries:
        raise SystemExit("no icon size matched an icns slot")
    body = b"".join(entries)
    return b"icns" + struct.pack(">I", len(body) + 8) + body


def add(zf, name, data, mode):
    info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = (mode << 16) | 0o100000
    info.compress_type = zipfile.ZIP_DEFLATED
    zf.writestr(info, data)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--installer-dir", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--app-name", default="Kittycord Installer")
    args = parser.parse_args()

    src = args.installer_dir
    app = f"{args.app_name}.app"

    plist = open(os.path.join(src, "macos", "Info.plist"), "rb").read()
    launcher = open(os.path.join(src, "macos", "KittycordInstaller"), "rb").read()
    command = open(os.path.join(src, "Kittycord-Install-macOS.command"), "rb").read()
    dialogs = open(os.path.join(src, "macos", "dialogs.applescript"), "rb").read()
    icns = build_icns(read_ico(os.path.join(src, "kittycord.ico")))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with zipfile.ZipFile(args.out, "w", zipfile.ZIP_DEFLATED) as zf:
        add(zf, f"{app}/Contents/Info.plist", plist, 0o644)
        add(zf, f"{app}/Contents/PkgInfo", b"APPL????", 0o644)
        add(zf, f"{app}/Contents/MacOS/KittycordInstaller", launcher, 0o755)
        add(zf, f"{app}/Contents/Resources/Kittycord.icns", icns, 0o644)
        add(zf, f"{app}/Contents/Resources/Kittycord-Install-macOS.command", command, 0o755)
        add(zf, f"{app}/Contents/Resources/dialogs.applescript", dialogs, 0o644)

    print(f"{args.out} ({os.path.getsize(args.out)} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
