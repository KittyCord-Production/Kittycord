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
[System.Windows.Forms.Application]::EnableVisualStyles()
$ProgressPreference = "SilentlyContinue"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls13
} catch {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}

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
$IconUrl     = "https://raw.githubusercontent.com/$Repo/main/browser/icon.png"
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

# fonts
$fTitle    = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Bold)
$fTag      = New-Object System.Drawing.Font("Segoe UI", 10)
$fSection  = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fBtn      = New-Object System.Drawing.Font("Segoe UI Semibold", 10, [System.Drawing.FontStyle]::Bold)
$fRowName  = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$fRowState = New-Object System.Drawing.Font("Segoe UI", 10)

# state shared with event handlers
$script:rowState = @{}
$script:rowCb = @{}

# logo (best effort; needs the repo to be public)
$logo = $null
try {
    $iconBytes = (Invoke-WebRequest -Uri $IconUrl -UseBasicParsing -TimeoutSec 15).Content
    $ms = New-Object System.IO.MemoryStream(, $iconBytes)
    $logo = [System.Drawing.Image]::FromStream($ms)
} catch { }

function Set-Rounded($ctrl, $radius) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $w = $ctrl.Width
    $h = $ctrl.Height
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($w - $d, 0, $d, $d, 270, 90)
    $path.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
    $path.AddArc(0, $h - $d, $d, $d, 90, 90)
    $path.CloseAllFigures()
    $ctrl.Region = New-Object System.Drawing.Region($path)
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
$form.ClientSize = New-Object System.Drawing.Size(720, 580)
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "FixedSingle"
$form.MaximizeBox = $false
$form.BackColor = $cBg
$form.ForeColor = $cText
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
if ($logo) {
    try { $form.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$logo).GetHicon()) } catch { }
}

# --- header banner ---
$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(0, 0)
$header.Size = New-Object System.Drawing.Size(720, 116)
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
    if ($logo) { $g.DrawImage($logo, 28, 28, 60, 60) }
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $soft  = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 240, 248))
    $g.DrawString("Kittycord", $fTitle, $white, 104, 26)
    $g.DrawString("The cutest Discord client mod - plugins, themes and pink.", $fTag, $soft, 106, 72)
    $white.Dispose(); $soft.Dispose()
})
$form.Controls.Add($header)

# --- section label ---
$selectLabel = New-Object System.Windows.Forms.Label
$selectLabel.Text = "Choose which Discord to patch"
$selectLabel.Font = $fSection
$selectLabel.ForeColor = $cPink
$selectLabel.AutoSize = $true
$selectLabel.Location = New-Object System.Drawing.Point(28, 134)
$form.Controls.Add($selectLabel)

# --- custom install list (no native blue selection) ---
$listCard = New-Object System.Windows.Forms.Panel
$listCard.Location = New-Object System.Drawing.Point(28, 162)
$listCard.Size = New-Object System.Drawing.Size(664, 104)
$listCard.BackColor = $cPanel
$form.Controls.Add($listCard)

$toggle = {
    param($s, $e)
    $idx = [int]$s.Tag
    $script:rowState[$idx] = -not $script:rowState[$idx]
    $script:rowCb[$idx].Invalidate()
}

$installs = @(Get-DiscordInstalls)
if ($installs.Count -eq 0) {
    $empty = New-Object System.Windows.Forms.Label
    $empty.Text = Get-NoInstallReason
    $empty.ForeColor = $cMuted
    $empty.AutoSize = $false
    $empty.Size = New-Object System.Drawing.Size(632, 84)
    $empty.Location = New-Object System.Drawing.Point(16, 12)
    $listCard.Controls.Add($empty)
} else {
    $rowY = 8
    for ($idx = 0; $idx -lt $installs.Count; $idx++) {
        $i = $installs[$idx]
        $script:rowState[$idx] = $true

        $row = New-Object System.Windows.Forms.Panel
        $row.Size = New-Object System.Drawing.Size(648, 30)
        $row.Location = New-Object System.Drawing.Point(8, $rowY)
        $row.BackColor = $cPanel
        $row.Tag = $idx
        $row.Cursor = "Hand"
        $row.Add_Click($toggle)

        $cb = New-Object System.Windows.Forms.Panel
        $cb.Size = New-Object System.Drawing.Size(18, 18)
        $cb.Location = New-Object System.Drawing.Point(8, 6)
        $cb.BackColor = $cPanel
        $cb.Tag = $idx
        $cb.Cursor = "Hand"
        $cb.Add_Click($toggle)
        $cb.Add_Paint({
            param($s, $e)
            $g = $e.Graphics
            $g.SmoothingMode = "AntiAlias"
            $on = $script:rowState[[int]$s.Tag]
            if ($on) {
                $b = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 95, 166))
                $g.FillRectangle($b, 0, 0, 17, 17)
                $b.Dispose()
                $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White, 2)
                $g.DrawLines($pen, @(
                    (New-Object System.Drawing.Point(3, 9)),
                    (New-Object System.Drawing.Point(7, 13)),
                    (New-Object System.Drawing.Point(14, 4))))
                $pen.Dispose()
            } else {
                $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 90, 108), 2)
                $g.DrawRectangle($pen, 0, 0, 16, 16)
                $pen.Dispose()
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
        $nameLbl.Location = New-Object System.Drawing.Point(36, 6)
        $nameLbl.Tag = $idx
        $nameLbl.Cursor = "Hand"
        $nameLbl.Add_Click($toggle)
        $row.Controls.Add($nameLbl)

        $nameW = [System.Windows.Forms.TextRenderer]::MeasureText($i.Name, $fRowName).Width
        $stateLbl = New-Object System.Windows.Forms.Label
        $stateLbl.Text = $i.State
        $stateLbl.Font = $fRowState
        $stateLbl.ForeColor = $cMuted
        $stateLbl.AutoSize = $true
        $stateLbl.BackColor = $cPanel
        $stateLbl.Location = New-Object System.Drawing.Point((44 + $nameW), 7)
        $stateLbl.Tag = $idx
        $stateLbl.Cursor = "Hand"
        $stateLbl.Add_Click($toggle)
        $row.Controls.Add($stateLbl)

        $listCard.Controls.Add($row)
        $rowY += 32
    }
}

# --- buttons ---
$btnInstall = New-Btn "Install" $cPink $cPinkHi
$btnInstall.Location = New-Object System.Drawing.Point(28, 284)
$btnInstall.Size = New-Object System.Drawing.Size(208, 48)
$form.Controls.Add($btnInstall)

$btnRepair = New-Btn "Reinstall / Repair" $cPurple $cPurpHi
$btnRepair.Location = New-Object System.Drawing.Point(256, 284)
$btnRepair.Size = New-Object System.Drawing.Size(208, 48)
$form.Controls.Add($btnRepair)

$btnUninstall = New-Btn "Uninstall" $cRed $cRedHi
$btnUninstall.Location = New-Object System.Drawing.Point(484, 284)
$btnUninstall.Size = New-Object System.Drawing.Size(208, 48)
$form.Controls.Add($btnUninstall)

# --- status box ---
$status = New-Object System.Windows.Forms.TextBox
$status.Location = New-Object System.Drawing.Point(28, 352)
$status.Size = New-Object System.Drawing.Size(664, 168)
$status.Multiline = $true
$status.ReadOnly = $true
$status.TabStop = $false
$status.HideSelection = $true
$status.ScrollBars = "Vertical"
$status.BackColor = $cPanel
$status.ForeColor = $cMuted
$status.BorderStyle = "FixedSingle"
$status.Font = New-Object System.Drawing.Font("Consolas", 9)
$form.Controls.Add($status)

# --- footer ---
$footer = New-Object System.Windows.Forms.Label
$footer.Text = "github.com/$Repo   -   client mods are against Discord's ToS; use at your own risk"
$footer.ForeColor = $cFaint
$footer.AutoSize = $true
$footer.Location = New-Object System.Drawing.Point(28, 530)
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
# log queue and finalises when it's done.
$script:work = [hashtable]::Synchronized(@{ Done = $false; Ok = $true })
$script:workQueue = [System.Collections.Queue]::Synchronized((New-Object System.Collections.Queue))
$script:doneMsg = ""

$workerBody = {
    function Log($m) { $q.Enqueue([string]$m) }
    try {
        if ($mode -eq "install") {
            Log "Downloading latest Kittycord build..."
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
            New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
            if (Test-Path $AsarPath) { Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue }
            $ok = $false; $err = "unknown error"

            # Streamed download so we can show real progress (never looks frozen on slow connections).
            for ($t = 0; $t -lt 2 -and -not $ok; $t++) {
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
                    $sum = 0; $lastPct = -10
                    while (($n = $inStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                        $outStream.Write($buffer, 0, $n)
                        $sum += $n
                        if ($total -gt 0) {
                            $pct = [int](($sum * 100) / $total)
                            if ($pct -ge $lastPct + 10) { $lastPct = $pct; Log ("Downloading... " + $pct + "%") }
                        }
                    }
                    $outStream.Close(); $inStream.Close(); $resp.Close()
                    if ((Test-Path $AsarPath) -and (Get-Item $AsarPath).Length -gt 500000) { $ok = $true }
                    else { $err = "downloaded file too small (is the repo public?)" }
                } catch {
                    $err = $_.Exception.Message
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
                    & $curl -L --fail --silent --show-error -A Kittycord-Installer -o $AsarPath $AsarUrl 2>$null
                    if ((Test-Path $AsarPath) -and (Get-Item $AsarPath).Length -gt 500000) { $ok = $true }
                }
            }
            if (-not $ok) { Log ("Download failed: " + $err); $st.Ok = $false; return }
            Log "Build downloaded. Patching..."
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
            Log "Done. Kittycord is installed."
        } else {
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
    if ($script:work.Done) {
        $script:poll.Stop()
        try { $script:wps.EndInvoke($script:whandle) } catch { }
        try { $script:wps.Dispose() } catch { }
        try { $script:wrs.Dispose() } catch { }
        Set-Busy $false
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
    # CreateDefault() so the worker has the standard cmdlets (Invoke-WebRequest, Get-Process,
    # Move-Item, Set-Content, ...). A bare runspace may only load the core engine.
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
    Set-Rounded $btnInstall 14
    Set-Rounded $btnRepair 14
    Set-Rounded $btnUninstall 14
    $form.ActiveControl = $btnInstall
    Write-Status "Ready. Select a Discord install and click Install."
})

try {
    [System.Windows.Forms.Application]::Run($form)
} catch {
    [System.Windows.Forms.MessageBox]::Show("Kittycord installer error:`n$($_.Exception.Message)", "Kittycord", "OK", "Error") | Out-Null
}
