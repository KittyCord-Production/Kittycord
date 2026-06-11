#Requires -Version 5.1
<#
    Kittycord - graphical installer (WinForms)

    A windowed, on-brand installer (no console window) that downloads the latest Kittycord build
    from GitHub Releases and patches the Discord desktop client. Compiled to Kittycord-Installer.exe
    by CI with `ps2exe -noConsole`. ASCII-only on purpose so Windows PowerShell 5.1 parses it.

    NOTE: the GitHub repo must be PUBLIC for the download to work (private-repo release assets are
    not publicly downloadable).
#>

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Native helpers: per-process DPI awareness (crisp on 125%/150% displays instead of blurry
# bitmap stretching) and a dark window titlebar to match the dark UI. Both are best-effort;
# if compilation fails the installer still works, just without these niceties.
$script:nativeOk = $false
try {
    Add-Type -Namespace KittycordNative -Name Win32 -MemberDefinition @'
[DllImport("shcore.dll")] public static extern int SetProcessDpiAwareness(int value);
[DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
'@
    $script:nativeOk = $true
} catch { }
if ($script:nativeOk) {
    # 1 = system DPI aware. Must run before the first window (incl. message boxes) is created.
    try { [void][KittycordNative.Win32]::SetProcessDpiAwareness(1) } catch { }
}

function Set-DarkTitlebar([IntPtr]$hwnd) {
    if (-not $script:nativeOk) { return }
    try {
        $on = 1
        # 20 = DWMWA_USE_IMMERSIVE_DARK_MODE (Win10 20H1+), 19 = same attribute on older builds
        [void][KittycordNative.Win32]::DwmSetWindowAttribute($hwnd, 20, [ref]$on, 4)
        [void][KittycordNative.Win32]::DwmSetWindowAttribute($hwnd, 19, [ref]$on, 4)
    } catch { }
}

[System.Windows.Forms.Application]::EnableVisualStyles()
$ProgressPreference = "SilentlyContinue"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

# UI scale factor: the layout below is designed in 96-dpi units and multiplied by the real
# screen DPI through S(), so the window looks identical (but sharp) on every scaling level.
$script:ui = 1.0
try {
    $g0 = [System.Drawing.Graphics]::FromHwnd([IntPtr]::Zero)
    $script:ui = [double]$g0.DpiX / 96.0
    $g0.Dispose()
} catch { }
function S([double]$v) { return [int][Math]::Round($v * $script:ui) }

# Admin is NOT required (Discord lives in the per-user %LOCALAPPDATA%). Running elevated *can*
# affect Discord's file permissions, so we only RECOMMEND against it - we don't block it.
try {
    $kcId = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $kcPrincipal = New-Object System.Security.Principal.WindowsPrincipal($kcId)
    if ($kcPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $kcAns = [System.Windows.Forms.MessageBox]::Show(
            "Tip: you don't need to run this as Administrator. Running as your normal user is recommended, since elevation can affect Discord's file permissions." + [Environment]::NewLine + [Environment]::NewLine +
            "Continue anyway?",
            "Kittycord", "YesNo", "Warning")
        if ($kcAns -eq [System.Windows.Forms.DialogResult]::No) { exit 0 }
    }
} catch { }

# ----- config -----
$Repo        = "CenturyRV/Kittycord"
$AsarUrl     = "https://github.com/$Repo/releases/latest/download/desktop.asar"
$InstallDir  = Join-Path $env:LOCALAPPDATA "Kittycord"
$AsarPath    = Join-Path $InstallDir "desktop.asar"
$AsarForward = ($AsarPath -replace '\\', '/')

# ----- palette (Kittycord pink/kawaii) -----
$cBg     = [System.Drawing.Color]::FromArgb(24, 14, 20)
$cPanel  = [System.Drawing.Color]::FromArgb(38, 24, 33)
$cPanel2 = [System.Drawing.Color]::FromArgb(52, 34, 46)
$cText   = [System.Drawing.Color]::FromArgb(255, 255, 255)
$cMuted  = [System.Drawing.Color]::FromArgb(226, 169, 203)
$cFaint  = [System.Drawing.Color]::FromArgb(150, 110, 130)
$cPink   = [System.Drawing.Color]::FromArgb(255, 95, 166)
$cPinkHi = [System.Drawing.Color]::FromArgb(255, 130, 188)
$cPurple = [System.Drawing.Color]::FromArgb(124, 92, 160)
$cPurpHi = [System.Drawing.Color]::FromArgb(150, 116, 188)
$cRed    = [System.Drawing.Color]::FromArgb(214, 64, 92)
$cRedHi  = [System.Drawing.Color]::FromArgb(232, 92, 118)
$cBorder = [System.Drawing.Color]::FromArgb(74, 46, 62)
$cBadge  = [System.Drawing.Color]::FromArgb(66, 42, 56)

# fonts (point-based, so they scale with the DPI automatically)
$fTitle    = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$fTag      = New-Object System.Drawing.Font("Segoe UI", 10)
$fSection  = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fBtn      = New-Object System.Drawing.Font("Segoe UI Semibold", 10, [System.Drawing.FontStyle]::Bold)
$fRowName  = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$fBar      = New-Object System.Drawing.Font("Segoe UI", 9)
$fBadge    = New-Object System.Drawing.Font("Segoe UI", 8.5)

# state shared with event handlers
$script:rowState = @{}
$script:rowCb = @{}
$script:rowBadge = @{}

# Kittycord logo, embedded as Base64 so the branding never depends on an extra network request.
$LogoB64 = "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"
$logo = $null
try {
    $ms = New-Object System.IO.MemoryStream(, [Convert]::FromBase64String($LogoB64))
    $logo = [System.Drawing.Image]::FromStream($ms)
} catch { }

function New-RoundedPath([int]$x, [int]$y, [int]$w, [int]$h, [int]$r) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    if ($d -gt $w) { $d = $w }
    if ($d -gt $h) { $d = $h }
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseAllFigures()
    return $path
}

function Set-Rounded($ctrl, $radius) {
    $path = New-RoundedPath 0 0 $ctrl.Width $ctrl.Height $radius
    $ctrl.Region = New-Object System.Drawing.Region($path)
}

# Soft radial glow (website-style) drawn into an existing Graphics.
function Draw-Glow($g, [int]$x, [int]$y, [int]$w, [int]$h, $color) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($x, $y, $w, $h)
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $brush.CenterColor = $color
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
}

# Tiny plus-shaped sparkle for the header. Coordinates are expected pre-scaled.
function Draw-Sparkle($g, [int]$x, [int]$y, [int]$r, [int]$alpha) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, 255, 255, 255), (S 2))
    $pen.StartCap = "Round"
    $pen.EndCap = "Round"
    $g.DrawLine($pen, ($x - $r), $y, ($x + $r), $y)
    $g.DrawLine($pen, $x, ($y - $r), $x, ($y + $r))
    $pen.Dispose()
}

function New-Btn($text, $color, $hover) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = $text
    $b.BackColor = $color
    $b.ForeColor = $cText
    $b.FlatStyle = "Flat"
    $b.FlatAppearance.BorderSize = 0
    $b.FlatAppearance.MouseOverBackColor = $hover
    $b.Font = $fBtn
    $b.Cursor = "Hand"
    return $b
}

# ----- discord detection -----
function Get-DiscordInstalls {
    $branches = @(
        @{ Name = "Discord (Stable)"; Dir = "Discord";       Proc = "Discord" }
        @{ Name = "Discord PTB";      Dir = "DiscordPTB";    Proc = "DiscordPTB" }
        @{ Name = "Discord Canary";   Dir = "DiscordCanary"; Proc = "DiscordCanary" }
    )
    $found = @()
    foreach ($b in $branches) {
        $base = Join-Path $env:LOCALAPPDATA $b.Dir
        if (-not (Test-Path $base)) { continue }
        $appDir = Get-ChildItem -Path $base -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
            Sort-Object Name -Descending | Select-Object -First 1
        if (-not $appDir) { continue }
        $res = Join-Path $appDir.FullName "resources"
        if (-not (Test-Path $res)) { continue }

        $state = "not patched"
        $indexJs = Join-Path $res "app\index.js"
        if (Test-Path $indexJs) {
            $content = Get-Content $indexJs -Raw -ErrorAction SilentlyContinue
            if ($content -match "Kittycord") { $state = "Kittycord installed" }
            else { $state = "patched by another mod" }
        }
        $found += [pscustomobject]@{ Name = $b.Name; Proc = $b.Proc; Resources = $res; State = $state }
    }
    return $found
}

# The Microsoft Store version of Discord is a packaged app under WindowsApps; its files are
# read-only and can't be patched. Detect it so we can tell the user instead of "not found".
function Test-MicrosoftStoreDiscord {
    try { return [bool](Get-AppxPackage -Name "*Discord*" -ErrorAction SilentlyContinue | Select-Object -First 1) }
    catch { return $false }
}

# When no patchable install is found, explain exactly why.
function Get-NoInstallReason {
    if (Test-MicrosoftStoreDiscord) {
        return "Microsoft Store Discord found - that version can't be patched. Please uninstall it, install Discord from discord.com, then run this installer again."
    }
    foreach ($dir in @("Discord", "DiscordPTB", "DiscordCanary")) {
        if (Test-Path (Join-Path $env:LOCALAPPDATA $dir)) {
            return "Discord is installed but hasn't finished setting up. Open Discord once and let it fully load, then close it and run this installer again."
        }
    }
    return "Discord was not found. Install the Discord desktop app from discord.com first, then run this installer again."
}

# Download + patch/unpatch run in a background runspace (see Start-Work below) so the window
# never freezes during the large download.

# ================= UI =================
$form = New-Object System.Windows.Forms.Form
$form.Text = "Kittycord Installer"
$form.ClientSize = New-Object System.Drawing.Size((S 720), (S 580))
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = $cBg
$form.ForeColor = $cText
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Add_HandleCreated({ Set-DarkTitlebar $form.Handle })
$form.Add_Paint({
    param($s, $e)
    Draw-Glow $e.Graphics (S 60) (S 110) (S 600) (S 420) ([System.Drawing.Color]::FromArgb(28, 255, 95, 166))
})
if ($logo) {
    try { $form.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$logo).GetHicon()) } catch { }
}

# --- header banner ---
$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(0, 0)
$header.Size = New-Object System.Drawing.Size((S 720), (S 116))
$header.Add_Paint({
    param($s, $e)
    $rect = $s.ClientRectangle
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(255, 138, 196),
        [System.Drawing.Color]::FromArgb(255, 61, 139), 15)
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()

    # soft light from the top left + a few sparkles on the quiet right side
    Draw-Glow $g (S -80) (S -100) (S 460) (S 300) ([System.Drawing.Color]::FromArgb(60, 255, 255, 255))
    Draw-Sparkle $g (S 540) (S 34) (S 5) 170
    Draw-Sparkle $g (S 588) (S 76) (S 3) 120
    Draw-Sparkle $g (S 632) (S 28) (S 7) 200
    Draw-Sparkle $g (S 668) (S 64) (S 4) 140
    Draw-Sparkle $g (S 700) (S 96) (S 3) 110

    if ($logo) {
        Draw-Glow $g (S 12) (S 12) (S 92) (S 92) ([System.Drawing.Color]::FromArgb(110, 255, 255, 255))
        $g.DrawImage($logo, (S 28), (S 28), (S 60), (S 60))
    }
    $shadow = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(70, 0, 0, 0))
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $soft  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, 248))
    $g.DrawString("Kittycord", $fTitle, $shadow, (S 106), (S 28))
    $g.DrawString("Kittycord", $fTitle, $white, (S 104), (S 26))
    $g.DrawString("The cutest Discord client mod - plugins, themes and pink.", $fTag, $soft, (S 106), (S 72))
    $shadow.Dispose(); $white.Dispose(); $soft.Dispose()
})
$form.Controls.Add($header)

# --- section label ---
$selectLabel = New-Object System.Windows.Forms.Label
$selectLabel.Text = ([string][char]9825 + "  Choose which Discord to patch")
$selectLabel.Font = $fSection
$selectLabel.ForeColor = $cPink
$selectLabel.AutoSize = $true
$selectLabel.Location = New-Object System.Drawing.Point((S 28), (S 134))
$form.Controls.Add($selectLabel)

# --- custom install list (no native blue selection) ---
$listCard = New-Object System.Windows.Forms.Panel
$listCard.Location = New-Object System.Drawing.Point((S 28), (S 162))
$listCard.Size = New-Object System.Drawing.Size((S 664), (S 104))
$listCard.BackColor = $cPanel
$listCard.Add_Paint({
    param($s, $e)
    $e.Graphics.SmoothingMode = "AntiAlias"
    $pen = New-Object System.Drawing.Pen ($cBorder)
    $path = New-RoundedPath 0 0 ($s.Width - 1) ($s.Height - 1) (S 12)
    $e.Graphics.DrawPath($pen, $path)
    $pen.Dispose(); $path.Dispose()
})
$form.Controls.Add($listCard)

$toggle = {
    param($s, $e)
    $idx = [int]$s.Tag
    $script:rowState[$idx] = -not $script:rowState[$idx]
    $script:rowCb[$idx].Invalidate()
}

function Set-RowHover($row, $on) {
    $col = $cPanel
    if ($on) { $col = $cPanel2 }
    $row.BackColor = $col
    foreach ($c in $row.Controls) { $c.BackColor = $col }
}
$rowEnter = {
    param($s, $e)
    $r = $s
    if ($r.Parent -ne $listCard) { $r = $r.Parent }
    Set-RowHover $r $true
}
$rowLeave = {
    param($s, $e)
    $r = $s
    if ($r.Parent -ne $listCard) { $r = $r.Parent }
    Set-RowHover $r $false
}

# install-state pill badge (data per row in $script:rowBadge, painted via Tag lookup)
$badgePaint = {
    param($s, $e)
    $d = $script:rowBadge[[int]$s.Tag]
    if (-not $d) { return }
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $w = $s.Width - 1
    $h = $s.Height - 1
    $path = New-RoundedPath 0 0 $w $h ([int]($h / 2))
    $b = New-Object System.Drawing.SolidBrush ($d.Back)
    $g.FillPath($b, $path)
    $b.Dispose(); $path.Dispose()
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = "Center"
    $sf.LineAlignment = "Center"
    $tb = New-Object System.Drawing.SolidBrush ($d.Fore)
    $g.DrawString($d.Text, $fBadge, $tb, (New-Object System.Drawing.RectangleF(0, 0, $s.Width, $s.Height)), $sf)
    $tb.Dispose(); $sf.Dispose()
}

$installs = @(Get-DiscordInstalls)
if ($installs.Count -eq 0) {
    $empty = New-Object System.Windows.Forms.Label
    $empty.Text = Get-NoInstallReason
    $empty.ForeColor = $cMuted
    $empty.AutoSize = $false
    $empty.Size = New-Object System.Drawing.Size((S 632), (S 84))
    $empty.Location = New-Object System.Drawing.Point((S 16), (S 12))
    $listCard.Controls.Add($empty)
} else {
    $rowY = 8
    for ($idx = 0; $idx -lt $installs.Count; $idx++) {
        $i = $installs[$idx]
        $script:rowState[$idx] = $true

        $row = New-Object System.Windows.Forms.Panel
        $row.Size = New-Object System.Drawing.Size((S 648), (S 30))
        $row.Location = New-Object System.Drawing.Point((S 8), (S $rowY))
        $row.BackColor = $cPanel
        $row.Tag = $idx
        $row.Cursor = "Hand"
        $row.Add_Click($toggle)
        $row.Add_MouseEnter($rowEnter)
        $row.Add_MouseLeave($rowLeave)

        $cb = New-Object System.Windows.Forms.Panel
        $cb.Size = New-Object System.Drawing.Size((S 18), (S 18))
        $cb.Location = New-Object System.Drawing.Point((S 8), (S 6))
        $cb.BackColor = $cPanel
        $cb.Tag = $idx
        $cb.Cursor = "Hand"
        $cb.Add_Click($toggle)
        $cb.Add_MouseEnter($rowEnter)
        $cb.Add_MouseLeave($rowLeave)
        $cb.Add_Paint({
            param($s, $e)
            $g = $e.Graphics
            $g.SmoothingMode = "AntiAlias"
            $w = $s.Width - 1
            $h = $s.Height - 1
            $on = $script:rowState[[int]$s.Tag]
            if ($on) {
                $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 95, 166))
                $path = New-RoundedPath 0 0 $w $h (S 5)
                $g.FillPath($b, $path)
                $b.Dispose(); $path.Dispose()
                $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, (S 2))
                $pen.StartCap = "Round"
                $pen.EndCap = "Round"
                $g.DrawLines($pen, @(
                    (New-Object System.Drawing.Point((S 4), (S 9))),
                    (New-Object System.Drawing.Point((S 7), (S 12))),
                    (New-Object System.Drawing.Point((S 13), (S 5)))))
                $pen.Dispose()
            } else {
                $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 90, 108), (S 2))
                $path = New-RoundedPath 1 1 ($w - 1) ($h - 1) (S 5)
                $g.DrawPath($pen, $path)
                $pen.Dispose(); $path.Dispose()
            }
        })
        $script:rowCb[$idx] = $cb
        $row.Controls.Add($cb)

        $nameLbl = New-Object System.Windows.Forms.Label
        $nameLbl.Text = $i.Name
        $nameLbl.Font = $fRowName
        $nameLbl.ForeColor = $cText
        $nameLbl.AutoSize = $true
        $nameLbl.BackColor = $cPanel
        $nameLbl.Location = New-Object System.Drawing.Point((S 36), (S 6))
        $nameLbl.Tag = $idx
        $nameLbl.Cursor = "Hand"
        $nameLbl.Add_Click($toggle)
        $nameLbl.Add_MouseEnter($rowEnter)
        $nameLbl.Add_MouseLeave($rowLeave)
        $row.Controls.Add($nameLbl)

        $badgeBack = $cBadge
        $badgeFore = $cMuted
        if ($i.State -eq "Kittycord installed") { $badgeBack = $cPink; $badgeFore = [System.Drawing.Color]::White }
        elseif ($i.State -eq "patched by another mod") { $badgeBack = $cPurple; $badgeFore = [System.Drawing.Color]::White }
        $script:rowBadge[$idx] = @{ Text = $i.State; Back = $badgeBack; Fore = $badgeFore }

        $nameW = [System.Windows.Forms.TextRenderer]::MeasureText($i.Name, $fRowName).Width
        $badgeW = [System.Windows.Forms.TextRenderer]::MeasureText($i.State, $fBadge).Width + (S 18)
        $badge = New-Object System.Windows.Forms.Panel
        $badge.Size = New-Object System.Drawing.Size($badgeW, (S 19))
        $badge.Location = New-Object System.Drawing.Point(((S 48) + $nameW), (S 6))
        $badge.BackColor = $cPanel
        $badge.Tag = $idx
        $badge.Cursor = "Hand"
        $badge.Add_Click($toggle)
        $badge.Add_MouseEnter($rowEnter)
        $badge.Add_MouseLeave($rowLeave)
        $badge.Add_Paint($badgePaint)
        $row.Controls.Add($badge)

        $listCard.Controls.Add($row)
        $rowY += 32
    }
}

# --- buttons ---
$btnInstall = New-Btn ([string][char]9829 + "  Install") $cPink $cPinkHi
$btnInstall.Location = New-Object System.Drawing.Point((S 28), (S 284))
$btnInstall.Size = New-Object System.Drawing.Size((S 208), (S 48))
$form.Controls.Add($btnInstall)

$btnRepair = New-Btn ([string][char]8635 + "  Reinstall / Repair") $cPurple $cPurpHi
$btnRepair.Location = New-Object System.Drawing.Point((S 256), (S 284))
$btnRepair.Size = New-Object System.Drawing.Size((S 208), (S 48))
$form.Controls.Add($btnRepair)

$btnUninstall = New-Btn ([string][char]10005 + "  Uninstall") $cRed $cRedHi
$btnUninstall.Location = New-Object System.Drawing.Point((S 484), (S 284))
$btnUninstall.Size = New-Object System.Drawing.Size((S 208), (S 48))
$form.Controls.Add($btnUninstall)

# --- progress bar (custom painted, driven by the background worker) ---
$progress = New-Object System.Windows.Forms.Panel
$progress.Location = New-Object System.Drawing.Point((S 28), (S 348))
$progress.Size = New-Object System.Drawing.Size((S 664), (S 22))
$progress.BackColor = $cBg
try {
    $dbProp = [System.Windows.Forms.Panel].GetProperty("DoubleBuffered", [System.Reflection.BindingFlags]"Instance,NonPublic")
    $dbProp.SetValue($progress, $true, $null)
} catch { }
$progress.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $w = $s.Width - 1
    $h = $s.Height - 1
    $r = [int]($h / 2)

    $track = New-RoundedPath 0 0 $w $h $r
    $tb = New-Object System.Drawing.SolidBrush ($cPanel2)
    $g.FillPath($tb, $track)
    $tp = New-Object System.Drawing.Pen ($cBorder)
    $g.DrawPath($tp, $track)
    $tp.Dispose(); $tb.Dispose(); $track.Dispose()

    $pct = 0
    try { $pct = [int]$script:work.Pct } catch { }
    if ($pct -gt 0) {
        if ($pct -gt 100) { $pct = 100 }
        $fw = [int]($w * $pct / 100)
        if ($fw -lt $h) { $fw = $h }
        $fillRect = New-Object System.Drawing.Rectangle(0, 0, $fw, $h)
        $fill = New-RoundedPath 0 0 $fw $h $r
        $fb = New-Object System.Drawing.Drawing2D.LinearGradientBrush($fillRect, $cPink, $cPinkHi, 0)
        $g.FillPath($fb, $fill)
        $fb.Dispose(); $fill.Dispose()
    }

    $txt = ""
    try { $txt = [string]$script:work.Note } catch { }
    if ($txt) {
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = "Center"
        $sf.LineAlignment = "Center"
        $tw = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
        $g.DrawString($txt, $fBar, $tw, (New-Object System.Drawing.RectangleF(0, 0, $s.Width, $s.Height)), $sf)
        $tw.Dispose(); $sf.Dispose()
    }
})
$form.Controls.Add($progress)

# --- status box (borderless TextBox inside a rounded card) ---
$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point((S 28), (S 382))
$statusCard.Size = New-Object System.Drawing.Size((S 664), (S 132))
$statusCard.BackColor = $cPanel
$statusCard.Add_Paint({
    param($s, $e)
    $e.Graphics.SmoothingMode = "AntiAlias"
    $pen = New-Object System.Drawing.Pen ($cBorder)
    $path = New-RoundedPath 0 0 ($s.Width - 1) ($s.Height - 1) (S 12)
    $e.Graphics.DrawPath($pen, $path)
    $pen.Dispose(); $path.Dispose()
})
$form.Controls.Add($statusCard)

$status = New-Object System.Windows.Forms.TextBox
$status.Location = New-Object System.Drawing.Point((S 14), (S 10))
$status.Size = New-Object System.Drawing.Size((S 636), (S 112))
$status.Multiline = $true
$status.ReadOnly = $true
$status.TabStop = $false
$status.HideSelection = $true
$status.ScrollBars = "Vertical"
$status.BackColor = $cPanel
$status.ForeColor = $cMuted
$status.BorderStyle = "None"
$status.Font = New-Object System.Drawing.Font("Consolas", 9)
$statusCard.Controls.Add($status)

# --- footer (clickable repo link + ToS note) ---
$sep = New-Object System.Windows.Forms.Panel
$sep.Location = New-Object System.Drawing.Point((S 28), (S 524))
$sep.Size = New-Object System.Drawing.Size((S 664), 1)
$sep.BackColor = $cPanel2
$form.Controls.Add($sep)

$footer = New-Object System.Windows.Forms.LinkLabel
$footer.Text = "github.com/$Repo   -   client mods are against Discord's ToS; use at your own risk"
$footer.ForeColor = $cFaint
$footer.LinkColor = $cMuted
$footer.ActiveLinkColor = $cPinkHi
$footer.LinkBehavior = "HoverUnderline"
$footer.LinkArea = New-Object System.Windows.Forms.LinkArea(0, ("github.com/$Repo").Length)
$footer.AutoSize = $true
$footer.BackColor = $cBg
$footer.Location = New-Object System.Drawing.Point((S 28), (S 536))
$footer.Add_LinkClicked({ try { Start-Process "https://github.com/$Repo" } catch { } })
$form.Controls.Add($footer)

function Write-Status($msg) {
    $status.AppendText($msg + "`r`n")
    $status.SelectionStart = $status.TextLength
    $status.SelectionLength = 0
    $status.ScrollToCaret()
}

function Get-Selected {
    $sel = @()
    foreach ($k in $script:rowState.Keys) {
        if ($script:rowState[$k] -and $k -lt $installs.Count) { $sel += $installs[$k] }
    }
    return $sel
}

function Set-Busy($busy) {
    $btnInstall.Enabled = -not $busy
    $btnRepair.Enabled = -not $busy
    $btnUninstall.Enabled = -not $busy
    if ($busy) { $form.Cursor = "WaitCursor" } else { $form.Cursor = "Default" }
}

# --- background worker: keeps the UI responsive (no "Not Responding") ---
# All heavy work (download + patch/unpatch) runs in a separate runspace; a UI timer drains its
# log queue, repaints the progress bar and finalises when it's done.
$script:work = [hashtable]::Synchronized(@{ Done = $false; Ok = $true; Pct = 0; Note = "" })
$script:workQueue = [System.Collections.Queue]::Synchronized((New-Object System.Collections.Queue))
$script:doneMsg = ""

$workerBody = {
    function Log($m) { $q.Enqueue([string]$m) }

    # SHA-256 published next to the asar by CI. $null when a release predates the checksum files.
    function Get-ExpectedHash {
        try {
            $r = Invoke-WebRequest -Uri ($AsarUrl + ".sha256") -UseBasicParsing -TimeoutSec 15
            $c = $r.Content
            if ($c -is [byte[]]) { $c = [System.Text.Encoding]::ASCII.GetString($c) }
            $c = ([string]$c).Trim().ToLower()
            if ($c -match '^[0-9a-f]{64}$') { return $c }
        } catch { }
        return $null
    }

    function Test-AsarFile([string]$expected) {
        if (-not (Test-Path $AsarPath)) {
            $script:dlErr = "download did not produce a file"
            return $false
        }
        if ((Get-Item $AsarPath).Length -le 500000) {
            $script:dlErr = "downloaded file too small (is the repo public?)"
            return $false
        }
        if ($expected) {
            $actual = (Get-FileHash -Path $AsarPath -Algorithm SHA256).Hash.ToLower()
            if ($actual -ne $expected) {
                $script:dlErr = "checksum mismatch - the download may be corrupted, or a new release is publishing right now. Please try again in a minute."
                Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue
                return $false
            }
            Log "Checksum verified (SHA-256 OK)."
        } else {
            Log "No checksum published for this release - skipping verification."
        }
        return $true
    }

    try {
        if ($mode -eq "install") {
            Log "Downloading latest Kittycord build..."
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
            New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
            $expected = Get-ExpectedHash
            $ok = $false
            $script:dlErr = "unknown error"

            # Streamed download so the progress bar shows real progress (never looks frozen on
            # slow connections). Each attempt is verified before it counts as a success.
            for ($t = 0; $t -lt 2 -and -not $ok; $t++) {
                if (Test-Path $AsarPath) { Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue }
                $inStream = $null; $outStream = $null; $resp = $null
                try {
                    $req = [System.Net.HttpWebRequest]::Create($AsarUrl)
                    $req.UserAgent = "Kittycord-Installer"
                    $req.Timeout = 30000
                    $req.ReadWriteTimeout = 120000
                    $resp = $req.GetResponse()
                    $total = $resp.ContentLength
                    $inStream = $resp.GetResponseStream()
                    $outStream = [System.IO.File]::Create($AsarPath)
                    $buffer = New-Object byte[] 81920
                    $sum = 0; $lastPct = -1; $lastMb = -1.0
                    while (($n = $inStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $outStream.Write($buffer, 0, $n)
                        $sum += $n
                        if ($total -gt 0) {
                            $pct = [int](($sum * 100) / $total)
                            if ($pct -ne $lastPct) {
                                $lastPct = $pct
                                $st.Pct = $pct
                                $st.Note = "Downloading... " + $pct + "%  (" + ([Math]::Round($sum / 1MB, 1)) + " / " + ([Math]::Round($total / 1MB, 1)) + " MB)"
                            }
                        } else {
                            $mb = [Math]::Round($sum / 1MB, 1)
                            if ($mb -ne $lastMb) { $lastMb = $mb; $st.Note = "Downloading... " + $mb + " MB" }
                        }
                    }
                    $outStream.Close(); $inStream.Close(); $resp.Close()
                    Log ("Downloaded " + ([Math]::Round($sum / 1MB, 1)) + " MB.")
                    $ok = Test-AsarFile $expected
                } catch {
                    $script:dlErr = $_.Exception.Message
                    try { if ($outStream) { $outStream.Close() } } catch { }
                    try { if ($inStream) { $inStream.Close() } } catch { }
                    try { if ($resp) { $resp.Close() } } catch { }
                    if (Test-Path $AsarPath) { Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue }
                    Start-Sleep -Seconds 2
                }
            }
            # Fallback: bundled curl.exe (Windows 10/11).
            if (-not $ok) {
                $curl = Join-Path $env:SystemRoot "System32\curl.exe"
                if (Test-Path $curl) {
                    Log "Retrying download via curl..."
                    $st.Pct = 0
                    $st.Note = "Retrying download..."
                    & $curl -L --fail --silent --show-error -A Kittycord-Installer -o $AsarPath $AsarUrl 2>$null
                    $ok = Test-AsarFile $expected
                }
            }
            if (-not $ok) {
                Log ("Download failed: " + $script:dlErr)
                $st.Note = "Download failed"
                $st.Ok = $false
                return
            }
            $st.Pct = 100
            $st.Note = "Patching Discord..."
            Log "Build downloaded. Discord will be closed and restarted. Patching..."
            $idx = 'try {' + "`r`n" +
                '    require("' + $AsarForward + '");' + "`r`n" +
                '} catch (err) {' + "`r`n" +
                '    console.error("[Kittycord] Failed to load, starting vanilla Discord:", err);' + "`r`n" +
                '    require("../_app.asar");' + "`r`n" +
                '}'
            foreach ($i in $sel) {
                try {
                    Get-Process -Name $i.Proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 1200
                    $res = $i.Resources
                    $appAsar = Join-Path $res "app.asar"
                    $backup = Join-Path $res "_app.asar"
                    $appDir = Join-Path $res "app"
                    if ((Test-Path $appAsar) -and -not (Test-Path $backup)) { Move-Item -Path $appAsar -Destination $backup -Force }
                    if (-not (Test-Path $backup)) { throw "no original app.asar/_app.asar found" }
                    if (Test-Path $appDir) { Remove-Item -Path $appDir -Recurse -Force }
                    New-Item -ItemType Directory -Path $appDir | Out-Null
                    Set-Content -Path (Join-Path $appDir "package.json") -Encoding utf8 -Value '{ "name": "discord", "main": "index.js", "private": true }'
                    Set-Content -Path (Join-Path $appDir "index.js") -Encoding utf8 -Value $idx
                    Log ("Patched " + $i.Name + ".")
                } catch { Log ("Error patching " + $i.Name + ": " + $_.Exception.Message); $st.Ok = $false }
            }
            # Relaunch the patched Discord(s) so the user sees Kittycord immediately - no manual restart.
            foreach ($i in $sel) {
                try {
                    $updateExe = Join-Path $i.Resources "..\..\Update.exe"
                    if (Test-Path $updateExe) {
                        Start-Process -FilePath $updateExe -ArgumentList "--processStart", ($i.Proc + ".exe")
                        Log ("Restarting " + $i.Name + "...")
                    }
                } catch { }
            }
            $st.Note = "Done"
            Log "Done. Kittycord is installed."
        } else {
            $st.Note = "Removing Kittycord patch..."
            foreach ($i in $sel) {
                try {
                    Get-Process -Name $i.Proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 1200
                    $res = $i.Resources
                    $appAsar = Join-Path $res "app.asar"
                    $backup = Join-Path $res "_app.asar"
                    $appDir = Join-Path $res "app"
                    if (Test-Path $appDir) { Remove-Item -Path $appDir -Recurse -Force }
                    if ((Test-Path $backup) -and -not (Test-Path $appAsar)) { Move-Item -Path $backup -Destination $appAsar -Force }
                    Log ("Reverted " + $i.Name + ".")
                } catch { Log ("Error reverting " + $i.Name + ": " + $_.Exception.Message); $st.Ok = $false }
            }
            $st.Note = "Done"
            Log "Uninstalled. Start Discord again for a clean client."
        }
    } catch {
        Log ("Error: " + $_.Exception.Message); $st.Ok = $false
    } finally {
        $st.Done = $true
    }
}

$script:poll = New-Object System.Windows.Forms.Timer
$script:poll.Interval = 200
$script:poll.Add_Tick({
    while ($script:workQueue.Count -gt 0) { Write-Status ([string]$script:workQueue.Dequeue()) }
    $progress.Invalidate()
    if ($script:work.Done) {
        $script:poll.Stop()
        try { $script:wps.EndInvoke($script:whandle) } catch { }
        try { $script:wps.Dispose() } catch { }
        try { $script:wrs.Dispose() } catch { }
        Set-Busy $false
        $progress.Invalidate()
        if ($script:work.Ok) {
            [System.Windows.Forms.MessageBox]::Show($script:doneMsg, "Kittycord", "OK", "Information") | Out-Null
        } else {
            [System.Windows.Forms.MessageBox]::Show("Something went wrong - check the log in the window.", "Kittycord", "OK", "Warning") | Out-Null
        }
    }
})

function Start-Work($mode, $sel) {
    $script:work.Done = $false
    $script:work.Ok = $true
    $script:work.Pct = 0
    $script:work.Note = ""
    # CreateDefault() so the worker has the standard cmdlets (Invoke-WebRequest, Get-Process,
    # Move-Item, Set-Content, Get-FileHash, ...). A bare runspace may only load the core engine.
    $iss = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
    $rs = [runspacefactory]::CreateRunspace($iss)
    $rs.Open()
    $rs.SessionStateProxy.SetVariable("mode", $mode)
    $rs.SessionStateProxy.SetVariable("sel", $sel)
    $rs.SessionStateProxy.SetVariable("AsarUrl", $AsarUrl)
    $rs.SessionStateProxy.SetVariable("AsarPath", $AsarPath)
    $rs.SessionStateProxy.SetVariable("AsarForward", $AsarForward)
    $rs.SessionStateProxy.SetVariable("InstallDir", $InstallDir)
    $rs.SessionStateProxy.SetVariable("q", $script:workQueue)
    $rs.SessionStateProxy.SetVariable("st", $script:work)
    $ps = [PowerShell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript($workerBody)
    $script:wps = $ps
    $script:wrs = $rs
    $script:whandle = $ps.BeginInvoke()
    $script:poll.Start()
}

$btnInstall.Add_Click({
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status "Select at least one Discord install first."; return }
    Set-Busy $true
    $script:doneMsg = "Kittycord installed! Discord is restarting - if it doesn't reopen, just start it."
    Start-Work "install" $sel
})
$btnRepair.Add_Click({
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status "Select at least one Discord install first."; return }
    Set-Busy $true
    $script:doneMsg = "Kittycord installed! Discord is restarting - if it doesn't reopen, just start it."
    Start-Work "install" $sel
})
$btnUninstall.Add_Click({
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status "Select at least one Discord install first."; return }
    Set-Busy $true
    $script:doneMsg = "Kittycord removed. Start Discord again for a clean client."
    Start-Work "uninstall" $sel
})

$form.Add_Shown({
    Set-Rounded $btnInstall (S 14)
    Set-Rounded $btnRepair (S 14)
    Set-Rounded $btnUninstall (S 14)
    Set-Rounded $listCard (S 12)
    Set-Rounded $statusCard (S 12)
    $form.ActiveControl = $btnInstall
    Write-Status "Ready. Select a Discord install and click Install."
})

try {
    [System.Windows.Forms.Application]::Run($form)
} catch {
    [System.Windows.Forms.MessageBox]::Show("Kittycord installer error:`n$($_.Exception.Message)", "Kittycord", "OK", "Error") | Out-Null
}
