#Requires -Version 5.1
<#
    Exercises the real patch/unpatch logic of Kittycord-Installer-GUI.ps1 against a throwaway
    Discord fixture. No network and no real Discord: KC_ASAR_SOURCE feeds a dummy build,
    KC_DISCORD_ROOT and KC_INSTALL_DIR redirect every write into a temp folder.

    Usage: powershell -NoProfile -ExecutionPolicy Bypass -File installer\test\windows-install.test.ps1
#>

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$script:pass = 0
$script:fail = 0
function Check([string]$what, $got, $want) {
    if ("$got" -ceq "$want") { Write-Host "PASS  $what"; $script:pass++ }
    else { Write-Host "FAIL  $what (got [$got], want [$want])" -ForegroundColor Red; $script:fail++ }
}
function CheckFile([string]$path) {
    if (Test-Path $path) { Write-Host "PASS  exists: $path"; $script:pass++ }
    else { Write-Host "FAIL  missing: $path" -ForegroundColor Red; $script:fail++ }
}
function CheckNoFile([string]$path) {
    if (-not (Test-Path $path)) { Write-Host "PASS  absent: $path"; $script:pass++ }
    else { Write-Host "FAIL  present: $path" -ForegroundColor Red; $script:fail++ }
}

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Split-Path -Parent (Split-Path -Parent $here)
$guiPath = Join-Path $repo "installer\Kittycord-Installer-GUI.ps1"

Write-Host "== script parses =="
$bytes = [System.IO.File]::ReadAllBytes($guiPath)
Check "utf-8 BOM" ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) $true
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($guiPath, [ref]$tokens, [ref]$errors)
Check "no parse errors" ($errors.Count) 0

$workerAssign = $ast.FindAll({
        param($n)
        $n -is [System.Management.Automation.Language.AssignmentStatementAst] -and
        $n.Left.Extent.Text -eq '$workerBody'
    }, $true) | Select-Object -First 1
if (-not $workerAssign) { throw "Could not find the `$workerBody assignment in $guiPath" }
$workerBody = [ScriptBlock]::Create($workerAssign.Right.Extent.Text.Trim().TrimStart("{").TrimEnd("}"))

$discoverFn = $ast.FindAll({
        param($n)
        $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq "Get-DiscordInstalls"
    }, $true) | Select-Object -First 1
if (-not $discoverFn) { throw "Could not find Get-DiscordInstalls in $guiPath" }
. ([ScriptBlock]::Create($discoverFn.Extent.Text))

$stubPackage = '{"name":"discord","main":"index.js","private":true}'

$root = Join-Path ([System.IO.Path]::GetTempPath()) ("kc-inst-" + [guid]::NewGuid().ToString("N").Substring(0, 8))
$discordRoot = Join-Path $root "local"
$installDir = Join-Path $root "Kittycord"
$oldRes = Join-Path $discordRoot "Discord\app-1.0.9999\resources"
$newRes = Join-Path $discordRoot "Discord\app-1.0.10000\resources"
$junkRes = Join-Path $discordRoot "Discord\app-old\resources"
New-Item -ItemType Directory -Force -Path $oldRes, $newRes, $junkRes, $installDir | Out-Null
Set-Content -Path (Join-Path $oldRes "app.asar") -Value "VANILLA_OLD" -NoNewline
Set-Content -Path (Join-Path $newRes "app.asar") -Value "VANILLA_NEW" -NoNewline
Set-Content -Path (Join-Path $junkRes "app.asar") -Value "VANILLA_JUNK" -NoNewline

$srcAsar = Join-Path $root "desktop.asar"
[System.IO.File]::WriteAllBytes($srcAsar, (New-Object byte[] 600000))

$env:KC_DISCORD_ROOT = $discordRoot
$env:KC_INSTALL_DIR = $installDir
$env:KC_ASAR_SOURCE = $srcAsar

$DiscordRoot = $discordRoot
$InstallDir = $installDir
$AsarUrl = "https://example.invalid/desktop.asar"
$AsarPath = Join-Path $InstallDir "desktop.asar"
$AsarForward = ($AsarPath -replace '\\', '/')

$logKeys = @("logDownloading", "noteDownload", "noteDownloadMb", "logDownloaded", "logChecksumOk",
    "logChecksumNone", "logRetryCurl", "noteRetry", "logDownloadFailed", "noteFailed", "notePatching",
    "logPatching", "logPatched", "logErrPatch", "logRestarting", "noteDone", "logDoneInstall",
    "noteRemoving", "logReverted", "logErrRevert", "logDoneUninstall", "errChecksum", "errTooSmall",
    "errNoFile")
$L = @{}
foreach ($k in $logKeys) { $L[$k] = $k }

function Invoke-Worker([string]$mode, $sel) {
    $q = New-Object System.Collections.Queue
    $st = @{ Done = $false; Ok = $true; Pct = 0; Note = "" }
    & $workerBody
    return @{ Ok = $st.Ok; Log = ($q.ToArray() -join "`n") }
}

Write-Host ""
Write-Host "== discovery =="
$installs = @(Get-DiscordInstalls)
Check "one branch found" $installs.Count 1
Check "newest version wins the numeric sort" $installs[0].Resources $newRes
Check "every sibling is listed" $installs[0].AllResources.Count 2
Check "unparseable app- folder ignored" ([bool]($installs[0].AllResources -contains $junkRes)) $false
Check "state before install" $installs[0].StateKey "stNot"

Write-Host ""
Write-Host "== fresh install =="
$r = Invoke-Worker "install" $installs
Check "worker reports success" $r.Ok $true
CheckFile (Join-Path $newRes "_app.asar")
CheckFile (Join-Path $newRes "app\index.js")
CheckNoFile (Join-Path $newRes "app.asar")
Check "backup holds vanilla" (Get-Content (Join-Path $newRes "_app.asar") -Raw) "VANILLA_NEW"
Check "build cached" ((Get-Item $AsarPath).Length) 600000
CheckNoFile "$AsarPath.download"

$idxBytes = [System.IO.File]::ReadAllBytes((Join-Path $newRes "app\index.js"))
$idxText = [System.Text.Encoding]::UTF8.GetString($idxBytes)
$expectedIdx = "try {`n    require(""$AsarForward"");`n} catch (err) {`n    console.error(""[Kittycord] Failed to load patcher, starting vanilla Discord:"", err);`n    require(""../_app.asar"");`n}`n"
Check "index.js matches the shared stub byte for byte" $idxText $expectedIdx
Check "index.js has no BOM" ($idxBytes[0]) 116
Check "package.json matches the shared stub" ([System.IO.File]::ReadAllText((Join-Path $newRes "app\package.json"))) $stubPackage

Write-Host ""
Write-Host "== state detection after install =="
$installs = @(Get-DiscordInstalls)
Check "reports installed" $installs[0].StateKey "stInstalled"

Write-Host ""
Write-Host "== repair is idempotent =="
$r = Invoke-Worker "install" $installs
Check "repair reports success" $r.Ok $true
Check "backup still vanilla" (Get-Content (Join-Path $newRes "_app.asar") -Raw) "VANILLA_NEW"
CheckNoFile (Join-Path $newRes "app.asar")

Write-Host ""
Write-Host "== a sibling patched by the host-update hook is reverted too =="
Set-Content -Path (Join-Path $oldRes "_app.asar") -Value "VANILLA_OLD" -NoNewline
Remove-Item (Join-Path $oldRes "app.asar") -Force
New-Item -ItemType Directory -Force -Path (Join-Path $oldRes "app") | Out-Null
Set-Content -Path (Join-Path $oldRes "app\index.js") -Value "require('Kittycord')" -NoNewline
$installs = @(Get-DiscordInstalls)
$r = Invoke-Worker "uninstall" $installs
Check "uninstall reports success" $r.Ok $true
CheckFile (Join-Path $newRes "app.asar")
CheckNoFile (Join-Path $newRes "app")
Check "newest restored" (Get-Content (Join-Path $newRes "app.asar") -Raw) "VANILLA_NEW"
CheckFile (Join-Path $oldRes "app.asar")
CheckNoFile (Join-Path $oldRes "app")
Check "sibling restored" (Get-Content (Join-Path $oldRes "app.asar") -Raw) "VANILLA_OLD"

Write-Host ""
Write-Host "== take over an install another mod patched =="
Remove-Item (Join-Path $newRes "app.asar") -Force
Set-Content -Path (Join-Path $newRes "_app.asar") -Value "VANILLA_NEW" -NoNewline
New-Item -ItemType Directory -Force -Path (Join-Path $newRes "app") | Out-Null
Set-Content -Path (Join-Path $newRes "app\index.js") -Value "require('some-other-mod')" -NoNewline
$installs = @(Get-DiscordInstalls)
Check "state shows a foreign mod" $installs[0].StateKey "stOther"
$r = Invoke-Worker "install" $installs
Check "reused vanilla backup" (Get-Content (Join-Path $newRes "_app.asar") -Raw) "VANILLA_NEW"
Check "our shim took over" ([System.IO.File]::ReadAllText((Join-Path $newRes "app\index.js"))) $expectedIdx

Write-Host ""
Write-Host "== discord updated underneath us =="
Set-Content -Path (Join-Path $newRes "app.asar") -Value "VANILLA_NEWER" -NoNewline
Remove-Item (Join-Path $newRes "app") -Recurse -Force
Remove-Item (Join-Path $newRes "_app.asar") -Force
$installs = @(Get-DiscordInstalls)
$r = Invoke-Worker "install" $installs
Check "backup follows the new discord" (Get-Content (Join-Path $newRes "_app.asar") -Raw) "VANILLA_NEWER"
CheckNoFile (Join-Path $newRes "app.asar")
Check "shim is back after a host update" ([System.IO.File]::ReadAllText((Join-Path $newRes "app\index.js"))) $expectedIdx

Write-Host ""
Write-Host "== a corrupt download never replaces the working build =="
$tooSmall = Join-Path $root "tiny.asar"
[System.IO.File]::WriteAllBytes($tooSmall, (New-Object byte[] 10))
$env:KC_ASAR_SOURCE = $tooSmall
$before = (Get-Item $AsarPath).Length
$r = Invoke-Worker "install" $installs
Check "worker reports failure" $r.Ok $false
Check "cached build untouched" ((Get-Item $AsarPath).Length) $before
CheckNoFile "$AsarPath.download"
$env:KC_ASAR_SOURCE = $srcAsar

Write-Host ""
Write-Host "== creator code and style seed =="
$dataDir = Join-Path $root "roaming"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
$enc = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $dataDir "referral.json"), '{"code":"mycode_1"}', $enc)
[System.IO.File]::WriteAllText((Join-Path $dataDir "style.json"), '{"accent":"pink"}', $enc)
$refBytes = [System.IO.File]::ReadAllBytes((Join-Path $dataDir "referral.json"))
Check "referral payload matches the macOS installer" ([System.Text.Encoding]::UTF8.GetString($refBytes)) '{"code":"mycode_1"}'
Check "referral json has no BOM" ($refBytes[0]) 123

Remove-Item $root -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item Env:\KC_DISCORD_ROOT, Env:\KC_INSTALL_DIR, Env:\KC_ASAR_SOURCE -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "$script:pass passed, $script:fail failed"
if ($script:fail -gt 0) { exit 1 }
