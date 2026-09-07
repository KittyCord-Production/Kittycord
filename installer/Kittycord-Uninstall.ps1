#Requires -Version 5.1
<#
    Kittycord - Windows uninstaller

    Reverts the Discord patch: removes the injected `app` folder and restores the
    original `app.asar` from the `_app.asar` backup.

    Usage (do NOT run as Administrator):
        powershell -ExecutionPolicy Bypass -File .\installer\Kittycord-Uninstall.ps1
#>

$ErrorActionPreference = "Stop"

$Branches = @(
    @{ Name = "Discord";        Dir = "Discord";       Proc = "Discord" }
    @{ Name = "Discord PTB";    Dir = "DiscordPTB";    Proc = "DiscordPTB" }
    @{ Name = "Discord Canary"; Dir = "DiscordCanary"; Proc = "DiscordCanary" }
)

function Get-AllResources([string]$baseDir) {
    if (-not (Test-Path $baseDir)) { return @() }
    Get-ChildItem -Path $baseDir -Directory -Filter "app-*" -ErrorAction SilentlyContinue |
        ForEach-Object { Join-Path $_.FullName "resources" } |
        Where-Object { Test-Path $_ }
}

$revertedAny = $false

foreach ($b in $Branches) {
    $base = Join-Path $env:LOCALAPPDATA $b.Dir
    foreach ($resources in (Get-AllResources $base)) {
        $appDir  = Join-Path $resources "app"
        $appAsar = Join-Path $resources "app.asar"
        $backup  = Join-Path $resources "_app.asar"

        if (-not (Test-Path $appDir) -and -not (Test-Path $backup)) { continue }

        Get-Process -Name $b.Proc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500

        if (Test-Path $appDir) { Remove-Item -Path $appDir -Recurse -Force }
        if ((Test-Path $backup) -and -not (Test-Path $appAsar)) {
            Move-Item -Path $backup -Destination $appAsar -Force
        }

        Write-Host "Reverted $($b.Name) at $resources" -ForegroundColor Green
        $revertedAny = $true
    }
}

if (-not $revertedAny) {
    Write-Host "Nothing to uninstall - no patched Discord installation found." -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "Kittycord removed. Start Discord again for a clean client." -ForegroundColor Magenta
}
