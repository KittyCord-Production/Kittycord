#Requires -Version 5.1
<#
    Kittycord — online installer

    Self-contained installer (no repo or pnpm needed). Downloads the latest Kittycord build
    (desktop.asar) from GitHub Releases and patches your Discord desktop client to load it.
    This is the script that gets compiled into Kittycord-Installer.exe by CI.

    Usage (do NOT run as Administrator):
        powershell -ExecutionPolicy Bypass -File .\installer\Kittycord-Online-Install.ps1

    Run again any time to re-patch after a Discord update. Uninstall with Kittycord-Uninstall.ps1.
#>

$ErrorActionPreference = "Stop"

$Repo       = "KittyCord-Production/Kittycord"
$AsarUrl    = "https://github.com/$Repo/releases/latest/download/desktop.asar"
$InstallDir = Join-Path $env:LOCALAPPDATA "Kittycord"
$AsarPath   = Join-Path $InstallDir "desktop.asar"

Write-Host "Kittycord installer" -ForegroundColor Magenta

# 1. Download the latest build
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Write-Host "Downloading latest Kittycord build..." -ForegroundColor Cyan
try {
    Invoke-WebRequest -Uri $AsarUrl -OutFile $AsarPath -UseBasicParsing
} catch {
    Write-Host "Failed to download the build from $AsarUrl" -ForegroundColor Red
    Write-Host "Make sure a release with a 'desktop.asar' asset exists." -ForegroundColor Yellow
    exit 1
}

# Verify the download against the SHA-256 checksum CI publishes next to the asar. Releases from
# before the checksum files exist have none - then verification is skipped.
$expected = $null
try {
    $shaResp = Invoke-WebRequest -Uri ($AsarUrl + ".sha256") -UseBasicParsing -TimeoutSec 15
    $shaText = $shaResp.Content
    if ($shaText -is [byte[]]) { $shaText = [System.Text.Encoding]::ASCII.GetString($shaText) }
    $shaText = ([string]$shaText).Trim().ToLower()
    if ($shaText -match '^[0-9a-f]{64}$') { $expected = $shaText }
} catch { }
if ($expected) {
    $actual = (Get-FileHash -Path $AsarPath -Algorithm SHA256).Hash.ToLower()
    if ($actual -ne $expected) {
        Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue
        Write-Host "Checksum mismatch - the download may be corrupted, or a new release is publishing right now." -ForegroundColor Red
        Write-Host "Please try again in a minute." -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Checksum verified (SHA-256 OK)." -ForegroundColor Green
} else {
    Write-Host "No checksum published for this release - skipping verification." -ForegroundColor Yellow
}

# Path used inside the injected index.js (forward slashes are safe for Node require on Windows)
$AsarForward = ($AsarPath -replace '\\', '/')

# 2. Patch Discord
$Branches = @(
    @{ Name = "Discord";        Dir = "Discord";       Proc = "Discord" }
    @{ Name = "Discord PTB";    Dir = "DiscordPTB";    Proc = "DiscordPTB" }
    @{ Name = "Discord Canary"; Dir = "DiscordCanary"; Proc = "DiscordCanary" }
)

function Get-LatestResources([string]$baseDir) {
    if (-not (Test-Path $baseDir)) { return $null }
    $appDirs = Get-ChildItem -Path $baseDir -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending
    foreach ($d in $appDirs) {
        $res = Join-Path $d.FullName "resources"
        if (Test-Path $res) { return $res }
    }
    return $null
}

$patchedAny = $false

foreach ($b in $Branches) {
    $base = Join-Path $env:LOCALAPPDATA $b.Dir
    $resources = Get-LatestResources $base
    if (-not $resources) { continue }

    Write-Host "Found $($b.Name) at $resources" -ForegroundColor Cyan

    Get-Process -Name $b.Proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    $appAsar = Join-Path $resources "app.asar"
    $backup  = Join-Path $resources "_app.asar"
    $appDir  = Join-Path $resources "app"

    if ((Test-Path $appAsar) -and -not (Test-Path $backup)) {
        Move-Item -Path $appAsar -Destination $backup -Force
    }
    if (-not (Test-Path $backup)) {
        Write-Host "  Could not find app.asar to patch. Skipping." -ForegroundColor Yellow
        continue
    }

    if (Test-Path $appDir) { Remove-Item -Path $appDir -Recurse -Force }
    New-Item -ItemType Directory -Path $appDir | Out-Null

    @'
{
    "name": "discord",
    "main": "index.js",
    "private": true
}
'@ | Set-Content -Path (Join-Path $appDir "package.json") -Encoding utf8

    # Load the downloaded asar (its package.json main = patcher.js). The patcher loads the
    # original Discord itself. Falls back to vanilla Discord if loading fails.
    $indexJs = @"
try {
    require("$AsarForward");
} catch (err) {
    console.error("[Kittycord] Failed to load, starting vanilla Discord:", err);
    require("../_app.asar");
}
"@
    $indexJs | Set-Content -Path (Join-Path $appDir "index.js") -Encoding utf8

    Write-Host "  Patched $($b.Name)." -ForegroundColor Green
    $patchedAny = $true
}

if (-not $patchedAny) {
    Write-Host "No Discord installation was found under %LOCALAPPDATA%." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Kittycord installed. Start Discord again to see it." -ForegroundColor Magenta
