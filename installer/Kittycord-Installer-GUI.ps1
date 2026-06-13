#Requires -Version 5.1
<#
    Kittycord - graphical installer (WinForms)

    A windowed, on-brand installer (no console window) that downloads the latest Kittycord build
    from GitHub Releases and patches the Discord desktop client. Compiled to Kittycord-Installer.exe
    by CI with `ps2exe -noConsole`.

    The file is saved as UTF-8 WITH BOM on purpose: the UI is localized (EN/DE/ES/FR/RU) and
    Windows PowerShell 5.1 only parses non-ASCII string literals correctly when the BOM is present.

    The pixel headline font is "Jersey 15" (SIL Open Font License), embedded as Base64 and loaded
    through a PrivateFontCollection so nothing has to be installed.

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
[DllImport("user32.dll")] public static extern bool ReleaseCapture();
[DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);
'@
    $script:nativeOk = $true
} catch { }
if ($script:nativeOk) {
    # 1 = system DPI aware. Must run before the first window (incl. message boxes) is created.
    try { [void][KittycordNative.Win32]::SetProcessDpiAwareness(1) } catch { }
}

# Dark color table for the language dropdown menu (best-effort; falls back to the default look).
$script:darkMenuOk = $false
try {
    Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System.Drawing;
using System.Windows.Forms;
public class KittycordMenuColors : ProfessionalColorTable {
    public override Color ToolStripDropDownBackground { get { return Color.FromArgb(33, 21, 28); } }
    public override Color ImageMarginGradientBegin { get { return Color.FromArgb(33, 21, 28); } }
    public override Color ImageMarginGradientMiddle { get { return Color.FromArgb(33, 21, 28); } }
    public override Color ImageMarginGradientEnd { get { return Color.FromArgb(33, 21, 28); } }
    public override Color MenuItemSelected { get { return Color.FromArgb(72, 45, 60); } }
    public override Color MenuItemBorder { get { return Color.FromArgb(72, 45, 60); } }
    public override Color MenuBorder { get { return Color.FromArgb(64, 40, 53); } }
}
'@
    $script:darkMenuOk = $true
} catch { }

function Set-DarkTitlebar([IntPtr]$hwnd) {
    if (-not $script:nativeOk) { return }
    try {
        $on = 1
        # 20 = DWMWA_USE_IMMERSIVE_DARK_MODE (Win10 20H1+), 19 = same attribute on older builds
        [void][KittycordNative.Win32]::DwmSetWindowAttribute($hwnd, 20, [ref]$on, 4)
        [void][KittycordNative.Win32]::DwmSetWindowAttribute($hwnd, 19, [ref]$on, 4)
        # 33 = DWMWA_WINDOW_CORNER_PREFERENCE, 2 = rounded (Win11; older builds ignore it)
        $round = 2
        [void][KittycordNative.Win32]::DwmSetWindowAttribute($hwnd, 33, [ref]$round, 4)
    } catch { }
}

# The window is borderless, so dragging anywhere on the background moves it.
function Start-WindowDrag {
    if (-not $script:nativeOk) { return }
    try {
        [void][KittycordNative.Win32]::ReleaseCapture()
        [void][KittycordNative.Win32]::SendMessage($form.Handle, 0xA1, 2, 0)
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

# ----- config -----
$Repo        = "CenturyRV/Kittycord"
$AsarUrl     = "https://github.com/$Repo/releases/latest/download/desktop.asar"
$InstallDir  = Join-Path $env:LOCALAPPDATA "Kittycord"
$AsarPath    = Join-Path $InstallDir "desktop.asar"
$AsarForward = ($AsarPath -replace '\\', '/')

# ----- localization -----
$script:LangCodes = @("en", "de", "es", "fr", "ru")
$script:LangNames = @("English", "Deutsch", "Español", "Français", "Русский")

$script:Strings = @{
    en = @{
        eyebrow          = "DISCORD CLIENT MOD  -  OFFICIAL INSTALLER"
        headline1        = "The cutest"
        headline2        = "Discord mod"
        tagline          = "Plugins, themes and a whole lot of pink - patched straight into your Discord in seconds."
        choose           = "Choose which Discord to patch"
        stInstalled      = "Kittycord installed"
        stNot            = "not patched"
        stOther          = "patched by another mod"
        btnInstall       = "Install"
        btnRepair        = "Reinstall / Repair"
        btnUninstall     = "Uninstall"
        ready            = "Ready. Select a Discord install and click Install."
        selectFirst      = "Select at least one Discord install first."
        logDownloading   = "Downloading latest Kittycord build..."
        noteDownload     = "Downloading... {0}%  ({1} / {2} MB)"
        noteDownloadMb   = "Downloading... {0} MB"
        logDownloaded    = "Downloaded {0} MB."
        logChecksumOk    = "Checksum verified (SHA-256 OK)."
        logChecksumNone  = "No checksum published for this release - skipping verification."
        logRetryCurl     = "Retrying download via curl..."
        noteRetry        = "Retrying download..."
        logDownloadFailed = "Download failed: {0}"
        noteFailed       = "Download failed"
        notePatching     = "Patching Discord..."
        logPatching      = "Build downloaded. Discord will be closed and restarted. Patching..."
        logPatched       = "Patched {0}."
        logErrPatch      = "Error patching {0}: {1}"
        logRestarting    = "Restarting {0}..."
        noteDone         = "Done"
        logDoneInstall   = "Done. Kittycord is installed."
        noteRemoving     = "Removing Kittycord patch..."
        logReverted      = "Reverted {0}."
        logErrRevert     = "Error reverting {0}: {1}"
        logDoneUninstall = "Uninstalled. Start Discord again for a clean client."
        msgDoneInstall   = "Kittycord installed! Discord is restarting - if it doesn't reopen, just start it."
        msgDoneUninstall = "Kittycord removed. Start Discord again for a clean client."
        msgError         = "Something went wrong - check the log in the window."
        errChecksum      = "checksum mismatch - the download may be corrupted, or a new release is publishing right now. Please try again in a minute."
        errTooSmall      = "downloaded file too small (is the repo public?)"
        errNoFile        = "download did not produce a file"
        noStore          = "Microsoft Store Discord found - that version can't be patched. Please uninstall it, install Discord from discord.com, then run this installer again."
        noSetup          = "Discord is installed but hasn't finished setting up. Open Discord once and let it fully load, then close it and run this installer again."
        noNone           = "Discord was not found. Install the Discord desktop app from discord.com first, then run this installer again."
        adminWarn        = "Tip: you don't need to run this as Administrator. Running as your normal user is recommended, since elevation can affect Discord's file permissions."
        adminAsk         = "Continue anyway?"
        toS              = "client mods are against Discord's ToS - use at your own risk"
        creatorCode      = "Creator code (optional) - got a friend's code? type it here"
    }
    de = @{
        eyebrow          = "DISCORD CLIENT MOD  -  OFFIZIELLER INSTALLER"
        headline1        = "The cutest"
        headline2        = "Discord mod"
        tagline          = "Plugins, Themes und ganz viel Pink - in Sekunden direkt in dein Discord gepatcht."
        choose           = "Wähle aus, welches Discord gepatcht wird"
        stInstalled      = "Kittycord installiert"
        stNot            = "nicht gepatcht"
        stOther          = "von anderem Mod gepatcht"
        btnInstall       = "Installieren"
        btnRepair        = "Reparieren"
        btnUninstall     = "Entfernen"
        ready            = "Bereit. Wähle eine Discord-Installation und klicke auf Installieren."
        selectFirst      = "Wähle zuerst mindestens eine Discord-Installation aus."
        logDownloading   = "Lade den neuesten Kittycord-Build herunter..."
        noteDownload     = "Lade herunter... {0}%  ({1} / {2} MB)"
        noteDownloadMb   = "Lade herunter... {0} MB"
        logDownloaded    = "{0} MB heruntergeladen."
        logChecksumOk    = "Prüfsumme verifiziert (SHA-256 OK)."
        logChecksumNone  = "Für dieses Release ist keine Prüfsumme veröffentlicht - Verifikation übersprungen."
        logRetryCurl     = "Versuche Download erneut über curl..."
        noteRetry        = "Versuche Download erneut..."
        logDownloadFailed = "Download fehlgeschlagen: {0}"
        noteFailed       = "Download fehlgeschlagen"
        notePatching     = "Patche Discord..."
        logPatching      = "Build heruntergeladen. Discord wird geschlossen und neu gestartet. Patche..."
        logPatched       = "{0} gepatcht."
        logErrPatch      = "Fehler beim Patchen von {0}: {1}"
        logRestarting    = "Starte {0} neu..."
        noteDone         = "Fertig"
        logDoneInstall   = "Fertig. Kittycord ist installiert."
        noteRemoving     = "Entferne Kittycord-Patch..."
        logReverted      = "{0} zurückgesetzt."
        logErrRevert     = "Fehler beim Zurücksetzen von {0}: {1}"
        logDoneUninstall = "Deinstalliert. Starte Discord erneut für einen sauberen Client."
        msgDoneInstall   = "Kittycord installiert! Discord startet neu - falls nicht, starte es einfach selbst."
        msgDoneUninstall = "Kittycord entfernt. Starte Discord erneut für einen sauberen Client."
        msgError         = "Etwas ist schiefgelaufen - sieh dir das Log im Fenster an."
        errChecksum      = "Prüfsummen-Fehler - der Download ist evtl. beschädigt oder ein neues Release wird gerade veröffentlicht. Versuch es in einer Minute erneut."
        errTooSmall      = "heruntergeladene Datei zu klein (ist das Repo öffentlich?)"
        errNoFile        = "Download hat keine Datei erzeugt"
        noStore          = "Microsoft-Store-Discord gefunden - diese Version kann nicht gepatcht werden. Bitte deinstalliere sie, installiere Discord von discord.com und starte den Installer erneut."
        noSetup          = "Discord ist installiert, aber noch nicht fertig eingerichtet. Öffne Discord einmal vollständig, schließe es und starte den Installer erneut."
        noNone           = "Discord wurde nicht gefunden. Installiere zuerst die Discord-Desktop-App von discord.com und starte den Installer erneut."
        adminWarn        = "Tipp: Du musst dieses Programm nicht als Administrator ausführen. Empfohlen ist dein normaler Benutzer, da erhöhte Rechte die Dateiberechtigungen von Discord beeinflussen können."
        adminAsk         = "Trotzdem fortfahren?"
        toS              = "Client-Mods verstoßen gegen Discords Nutzungsbedingungen - Nutzung auf eigene Gefahr"
    }
    es = @{
        eyebrow          = "MOD DE CLIENTE PARA DISCORD  -  INSTALADOR OFICIAL"
        headline1        = "The cutest"
        headline2        = "Discord mod"
        tagline          = "Plugins, temas y mucho rosa: parcheado directamente en tu Discord en segundos."
        choose           = "Elige qué Discord parchear"
        stInstalled      = "Kittycord instalado"
        stNot            = "sin parchear"
        stOther          = "parcheado por otro mod"
        btnInstall       = "Instalar"
        btnRepair        = "Reparar"
        btnUninstall     = "Desinstalar"
        ready            = "Listo. Elige una instalación de Discord y pulsa Instalar."
        selectFirst      = "Selecciona primero al menos una instalación de Discord."
        logDownloading   = "Descargando la última versión de Kittycord..."
        noteDownload     = "Descargando... {0}%  ({1} / {2} MB)"
        noteDownloadMb   = "Descargando... {0} MB"
        logDownloaded    = "{0} MB descargados."
        logChecksumOk    = "Suma de verificación correcta (SHA-256 OK)."
        logChecksumNone  = "Esta versión no publica suma de verificación - se omite la comprobación."
        logRetryCurl     = "Reintentando la descarga con curl..."
        noteRetry        = "Reintentando descarga..."
        logDownloadFailed = "Error de descarga: {0}"
        noteFailed       = "Error de descarga"
        notePatching     = "Parcheando Discord..."
        logPatching      = "Versión descargada. Discord se cerrará y se reiniciará. Parcheando..."
        logPatched       = "{0} parcheado."
        logErrPatch      = "Error al parchear {0}: {1}"
        logRestarting    = "Reiniciando {0}..."
        noteDone         = "Listo"
        logDoneInstall   = "Listo. Kittycord está instalado."
        noteRemoving     = "Quitando el parche de Kittycord..."
        logReverted      = "{0} restaurado."
        logErrRevert     = "Error al restaurar {0}: {1}"
        logDoneUninstall = "Desinstalado. Vuelve a abrir Discord para un cliente limpio."
        msgDoneInstall   = "¡Kittycord instalado! Discord se está reiniciando - si no se abre, ábrelo tú."
        msgDoneUninstall = "Kittycord eliminado. Vuelve a abrir Discord para un cliente limpio."
        msgError         = "Algo salió mal - revisa el registro de la ventana."
        errChecksum      = "la suma de verificación no coincide - la descarga puede estar dañada o se está publicando una nueva versión ahora mismo. Inténtalo de nuevo en un minuto."
        errTooSmall      = "el archivo descargado es demasiado pequeño (¿el repositorio es público?)"
        errNoFile        = "la descarga no generó ningún archivo"
        noStore          = "Se encontró el Discord de la Microsoft Store - esa versión no se puede parchear. Desinstálala, instala Discord desde discord.com y vuelve a ejecutar este instalador."
        noSetup          = "Discord está instalado pero aún no ha terminado de configurarse. Abre Discord una vez, deja que cargue, ciérralo y vuelve a ejecutar este instalador."
        noNone           = "No se encontró Discord. Instala primero la app de escritorio desde discord.com y vuelve a ejecutar este instalador."
        adminWarn        = "Consejo: no necesitas ejecutar esto como administrador. Se recomienda usar tu usuario normal, ya que la elevación puede afectar a los permisos de archivos de Discord."
        adminAsk         = "¿Continuar de todos modos?"
        toS              = "los mods de cliente van contra los ToS de Discord - úsalo bajo tu propia responsabilidad"
    }
    fr = @{
        eyebrow          = "MOD CLIENT DISCORD  -  INSTALLATEUR OFFICIEL"
        headline1        = "The cutest"
        headline2        = "Discord mod"
        tagline          = "Des plugins, des thèmes et beaucoup de rose - patché dans votre Discord en quelques secondes."
        choose           = "Choisissez quel Discord patcher"
        stInstalled      = "Kittycord installé"
        stNot            = "non patché"
        stOther          = "patché par un autre mod"
        btnInstall       = "Installer"
        btnRepair        = "Réparer"
        btnUninstall     = "Désinstaller"
        ready            = "Prêt. Choisissez une installation Discord et cliquez sur Installer."
        selectFirst      = "Sélectionnez d'abord au moins une installation Discord."
        logDownloading   = "Téléchargement de la dernière version de Kittycord..."
        noteDownload     = "Téléchargement... {0}%  ({1} / {2} Mo)"
        noteDownloadMb   = "Téléchargement... {0} Mo"
        logDownloaded    = "{0} Mo téléchargés."
        logChecksumOk    = "Somme de contrôle vérifiée (SHA-256 OK)."
        logChecksumNone  = "Aucune somme de contrôle publiée pour cette version - vérification ignorée."
        logRetryCurl     = "Nouvelle tentative de téléchargement via curl..."
        noteRetry        = "Nouvelle tentative..."
        logDownloadFailed = "Échec du téléchargement : {0}"
        noteFailed       = "Échec du téléchargement"
        notePatching     = "Patch de Discord en cours..."
        logPatching      = "Version téléchargée. Discord va être fermé puis relancé. Patch en cours..."
        logPatched       = "{0} patché."
        logErrPatch      = "Erreur lors du patch de {0} : {1}"
        logRestarting    = "Redémarrage de {0}..."
        noteDone         = "Terminé"
        logDoneInstall   = "Terminé. Kittycord est installé."
        noteRemoving     = "Suppression du patch Kittycord..."
        logReverted      = "{0} restauré."
        logErrRevert     = "Erreur lors de la restauration de {0} : {1}"
        logDoneUninstall = "Désinstallé. Relancez Discord pour un client propre."
        msgDoneInstall   = "Kittycord installé ! Discord redémarre - s'il ne se rouvre pas, lancez-le."
        msgDoneUninstall = "Kittycord supprimé. Relancez Discord pour un client propre."
        msgError         = "Un problème est survenu - consultez le journal dans la fenêtre."
        errChecksum      = "somme de contrôle incorrecte - le téléchargement est peut-être corrompu, ou une nouvelle version est en cours de publication. Réessayez dans une minute."
        errTooSmall      = "fichier téléchargé trop petit (le dépôt est-il public ?)"
        errNoFile        = "le téléchargement n'a produit aucun fichier"
        noStore          = "Discord du Microsoft Store détecté - cette version ne peut pas être patchée. Désinstallez-la, installez Discord depuis discord.com, puis relancez cet installateur."
        noSetup          = "Discord est installé mais sa configuration n'est pas terminée. Ouvrez Discord une fois, laissez-le charger, fermez-le, puis relancez cet installateur."
        noNone           = "Discord est introuvable. Installez d'abord l'application de bureau depuis discord.com, puis relancez cet installateur."
        adminWarn        = "Astuce : inutile de lancer ce programme en tant qu'administrateur. Utilisez votre compte normal, l'élévation peut affecter les permissions des fichiers de Discord."
        adminAsk         = "Continuer quand même ?"
        toS              = "les mods clients sont contraires aux CGU de Discord - à utiliser à vos risques"
    }
    ru = @{
        eyebrow          = "КЛИЕНТСКИЙ МОД ДЛЯ DISCORD  -  ОФИЦИАЛЬНЫЙ УСТАНОВЩИК"
        headline1        = "The cutest"
        headline2        = "Discord mod"
        tagline          = "Плагины, темы и много розового - патч прямо в ваш Discord за считанные секунды."
        choose           = "Выберите, какой Discord пропатчить"
        stInstalled      = "Kittycord установлен"
        stNot            = "не пропатчен"
        stOther          = "пропатчен другим модом"
        btnInstall       = "Установить"
        btnRepair        = "Переустановить"
        btnUninstall     = "Удалить"
        ready            = "Готово. Выберите установку Discord и нажмите Установить."
        selectFirst      = "Сначала выберите хотя бы одну установку Discord."
        logDownloading   = "Скачивание последней сборки Kittycord..."
        noteDownload     = "Скачивание... {0}%  ({1} / {2} МБ)"
        noteDownloadMb   = "Скачивание... {0} МБ"
        logDownloaded    = "Скачано {0} МБ."
        logChecksumOk    = "Контрольная сумма проверена (SHA-256 OK)."
        logChecksumNone  = "Для этого релиза нет контрольной суммы - проверка пропущена."
        logRetryCurl     = "Повторная попытка скачивания через curl..."
        noteRetry        = "Повторная попытка..."
        logDownloadFailed = "Ошибка скачивания: {0}"
        noteFailed       = "Ошибка скачивания"
        notePatching     = "Патч Discord..."
        logPatching      = "Сборка скачана. Discord будет закрыт и перезапущен. Патч..."
        logPatched       = "{0} пропатчен."
        logErrPatch      = "Ошибка патча {0}: {1}"
        logRestarting    = "Перезапуск {0}..."
        noteDone         = "Готово"
        logDoneInstall   = "Готово. Kittycord установлен."
        noteRemoving     = "Удаление патча Kittycord..."
        logReverted      = "{0} восстановлен."
        logErrRevert     = "Ошибка восстановления {0}: {1}"
        logDoneUninstall = "Удалено. Запустите Discord снова для чистого клиента."
        msgDoneInstall   = "Kittycord установлен! Discord перезапускается - если не откроется, запустите его сами."
        msgDoneUninstall = "Kittycord удалён. Запустите Discord снова для чистого клиента."
        msgError         = "Что-то пошло не так - посмотрите журнал в окне."
        errChecksum      = "контрольная сумма не совпадает - загрузка могла повредиться, или прямо сейчас публикуется новый релиз. Попробуйте снова через минуту."
        errTooSmall      = "скачанный файл слишком мал (репозиторий публичный?)"
        errNoFile        = "скачивание не создало файл"
        noStore          = "Найден Discord из Microsoft Store - эту версию нельзя пропатчить. Удалите её, установите Discord с discord.com и запустите установщик снова."
        noSetup          = "Discord установлен, но ещё не завершил настройку. Откройте Discord один раз, дайте загрузиться, закройте и запустите установщик снова."
        noNone           = "Discord не найден. Сначала установите настольное приложение с discord.com и запустите установщик снова."
        adminWarn        = "Совет: запускать от имени администратора не нужно. Рекомендуется обычный пользователь - повышение прав может повлиять на права файлов Discord."
        adminAsk         = "Всё равно продолжить?"
        toS              = "клиентские моды нарушают условия использования Discord - используйте на свой риск"
    }
}

$script:Lang = "en"
try {
    $sysLang = (Get-UICulture).TwoLetterISOLanguageName
    if ($script:LangCodes -contains $sysLang) { $script:Lang = $sysLang }
} catch { }

function T([string]$key) {
    $tbl = $script:Strings[$script:Lang]
    if ($tbl -and $tbl.ContainsKey($key)) { return $tbl[$key] }
    return $script:Strings["en"][$key]
}

# Admin is NOT required (Discord lives in the per-user %LOCALAPPDATA%). Running elevated *can*
# affect Discord's file permissions, so we only RECOMMEND against it - we don't block it.
try {
    $kcId = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $kcPrincipal = New-Object System.Security.Principal.WindowsPrincipal($kcId)
    if ($kcPrincipal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)) {
        $kcAns = [System.Windows.Forms.MessageBox]::Show(
            (T "adminWarn") + [Environment]::NewLine + [Environment]::NewLine + (T "adminAsk"),
            "Kittycord", "YesNo", "Warning")
        if ($kcAns -eq [System.Windows.Forms.DialogResult]::No) { exit 0 }
    }
} catch { }

# ----- palette (Kittycord pink on deep plum-black, Cylone-style editorial layout) -----
$cBg     = [System.Drawing.Color]::FromArgb(17, 10, 14)
$cPanel  = [System.Drawing.Color]::FromArgb(33, 21, 28)
$cPanel2 = [System.Drawing.Color]::FromArgb(48, 30, 40)
$cText   = [System.Drawing.Color]::FromArgb(255, 255, 255)
$cMuted  = [System.Drawing.Color]::FromArgb(214, 164, 192)
$cFaint  = [System.Drawing.Color]::FromArgb(141, 104, 124)
$cPink   = [System.Drawing.Color]::FromArgb(255, 95, 166)
$cPinkHi = [System.Drawing.Color]::FromArgb(255, 130, 188)
$cRedHi  = [System.Drawing.Color]::FromArgb(240, 110, 134)
$cBorder = [System.Drawing.Color]::FromArgb(64, 40, 53)

# ----- assets (embedded so nothing depends on extra network requests) -----
$LogoB64 = "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"
$logo = $null
try {
    $ms = New-Object System.IO.MemoryStream(, [Convert]::FromBase64String($LogoB64))
    $logo = [System.Drawing.Image]::FromStream($ms)
} catch { }

# "Jersey 15" pixel font (SIL OFL) for the big editorial headline.
$FontB64 = "AAEAAAARAQAABAAQR0RFRhNFEnQAAYs0AAAA3kdQT1NODYP3AAGMFAAABnJHU1VCEMgkUAABkogAAASiT1MvMqN2I/4AAAGYAAAAYGNtYXAFnqGLAAAHoAAABAZjdnQgEsIFFwAAGlwAAABEZnBnbWIu+3sAAAuoAAAODGdhc3AAAAAQAAGLLAAAAAhnbHlmYXzCdQAAHXgAAWJCaGVhZCePuqIAAAEcAAAANmhoZWEImwo0AAABVAAAACRobXR41R4tUAAAAfgAAAWobG9jYX9fKQoAABqgAAAC1m1heHADmg9IAAABeAAAACBuYW1lUl1xTgABf7wAAAOccG9zdPnP/78AAYNYAAAH0nByZXB0TtCiAAAZtAAAAKcAAQAAAAEAQrkrWnhfDzz1AA8FRgAAAADgSRz6AAAAAOOlWDf/OP7UBUYEGgAAAAYAAgAAAAAAAAABAAAEGv7UAAAFeP84/zgFRgVGAAAAAAAAAAAAAAAAAAABagABAAABagB0AAUAAAAAAAIAdADGAI0AAAEpDgwAAAAAAAQCKgGQAAUAAANuAyoAAABlA24DKgAAAdgAMgFKAAAAAAAAAAAAAAAAoAAAbwAAQEoAAAAAAAAAAE5PTkUAwAAgJpgEGv7UAAAEHgEsAAAAkwAAAAACJgLuAAAAIAACAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADIDUgAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgKKAAACWAAyAooAAAImADICJgAyAiYAMgImADICJgAyAiYAMgImADICJgAyAiYAMgH0ADICWAAyAlgAMgJYADICWAAyAlgAMgK8AAAA+gAyAyAAMgD6ADIA+v/OAPr/zgD6ADIA+gAyAPoAAAD6AAACJgAyAiYAMgImADICJgAyAfQAMgH0ADIB9AAyAfQAMgImAAADUgAyAooAMgKKADICigAyAooAMgKKADICigAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgK8AAACWAAyA1IAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICigAyAooAMgKKADICigAyAooAMgKKADICJgAyAiYAMgImADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgNSADIDUgAyA1IAMgNSADIDUgAyAlgAMgKKADICigAyAooAMgKKADICigAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADIDtgAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADIDIAAyAooAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgHCADICWAAyAlgAMgJYADICWAAyAlgAMgKKAAAA+gAyAPoAMgD6ADIA+v/OAPoAAAD6ADIA+gAyAiYAMgD6AAAA+gAAASwAAAEsAAABLAAAAfQAMgH0ADIA+gAyAPoAMgHCADIA+gAyAcIAAANSADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAAAJYADIDtgAyAlgAMgJYADICWAAyAfQAMgH0ADIB9AAyAfQAMgJYADICWAAyAlgAMgJYADICWAAyAooAMgH0ADICWAAyAfQAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICWAAyA1IAMgNSADIDUgAyA1IAMgNSADICWAAyAlgAMgJYADICWAAyAlgAMgJYADICJgAyAiYAMgImADICJgAyAlgAMgJYADICWAAyAiYAMgFeADICWAAyAlgAMgImADICJgAyAlgAMgImADICWAAyAlgAMgImADICJgAyAiYAMgImADICJgAyAiYAMgImADICJgAyAiYAMgImADIAMgAAASwAAAEsAAAA+gAyAPoAMgD6ADIA+gAyAu4AMgD6ADIA+gAyAiYAMgImADIA+gAyAZAAMgH0ADIDUgAyAfQAMgH0ADICJgDIAiYAyAImADICWAAyA1IAMgJYADIBXgAyAV4AMgGQADIBkAAyAZAAMgGQADIA+gAyAcIAMgHCADIBwgAyAPoAMgD6ADIDIAAyAyAAMgHCADIBwgAyAcIAMgD6ADICJgAyA4QAMgNSADICJgAyAlgAMgOEADICigAyBXgAMgGQADIBwgCWAlgAMgK8ADICvAAyAiYAMgKKADICigAyAooAMgJYADICigAyAlgAMgJYADICWAAyArwAMgKKADIDUgAyAAD/OAAA/5wAAP+c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ACAAYQB2AGEAaQBsAGEAYgBsAGUAIAB3AGkAdABoACAAYQAgAEYAQQBRACAAYQB0ADoAIABoAHQAdABwAHMAOgAvAC8AbwBwAGUAbgBmAG8AbgB0AGwAaQBjAGUAbgBzAGUALgBvAHIAZwBoAHQAdABwAHMAOgAvAC8AbwBwAGUAbgBmAG8AbgB0AGwAaQBjAGUAbgBzAGUALgBvAHIAZwACAAAAAAAA/5wAMgAAAAAAAAAAAAAAAAAAAAAAAAAAAWoAAAAkAMkBAgDHAGIArQEDAQQAYwCuAJAAJQAmAP0A/wBkAQUAJwDpAQYBBwAoAGUBCADIAMoBCQDLAQoBCwApACoA+AEMAQ0AKwEOACwBDwDMAM0AzgD6AM8BEAERAC0BEgAuARMALwEUARUBFgDiADAAMQEXARgBGQBmARoAMgDQANEAZwDTARsBHACRAK8AsAAzAO0ANAA1AR0BHgEfADYBIADkAPsBIQEiADcBIwEkADgA1AElANUAaADWASYBJwEoASkAOQA6ASoBKwEsAS0AOwA8AOsBLgC7AS8APQEwAOYBMQBEAGkBMgBrAGwAagEzATQAbgBtAKAARQBGAP4BAABvATUARwDqATYBAQBIAHABNwByAHMBOABxATkBOgBJAEoA+QE7ATwASwE9AEwA1wB0AHYAdwE+AHUBPwFAAUEATQFCAUMATgFEAE8BRQFGAUcA4wBQAFEBSAFJAUoAeAFLAFIAeQB7AHwAegFMAU0AoQB9ALEAUwDuAFQAVQFOAU8BUABWAVEA5QD8AVIAiQBXAVMBVABYAH4BVQCAAIEAfwFWAVcBWAFZAFkAWgFaAVsBXAFdAFsAXADsAV4AugFfAF0BYADnAWEBYgCdAJ4AEwAUABUAFgAXABgAGQAaABsAHAFjAWQBZQFmAWcBaAFpAWoBawFsAW0AAwFuABEADwAdAB4AqwAEAKMAIgCiAMMAhwANAAYAEgA/AW8BcAAQALIAswBCAAsADABeAGAAPgBAAMQAxQC0ALUAtgC3AKkAqgC+AL8ABQAKAXEAIwAJAIgAhgCLAIoAjACDAF8AhAAHAXIAhQCWAA4A7wDwALgAIAAhAB8AYQBBAAgBcwF0AXUBdgF3AXgBeQF6AXsBfAF9AX4BfwGAAYEBggGDAYQBhQGGAYcBiAGJAYoBiwGMAY0AjgDcAEMAjQDfANgA4QDbAN0A2QDaAN4A4AGOBkFicmV2ZQdBbWFjcm9uB0FvZ29uZWsKQ2RvdGFjY2VudAZEY2Fyb24GRGNyb2F0BkVjYXJvbgpFZG90YWNjZW50B0VtYWNyb24HRW9nb25lawd1bmkwMTIyCkdkb3RhY2NlbnQESGJhcgJJSgdJbWFjcm9uB0lvZ29uZWsLdW5pMDA0QTAzMDEHdW5pMDEzNgZMYWN1dGUGTGNhcm9uB3VuaTAxM0IGTmFjdXRlBk5jYXJvbgd1bmkwMTQ1A0VuZw1PaHVuZ2FydW1sYXV0B09tYWNyb24GUmFjdXRlBlJjYXJvbgd1bmkwMTU2BlNhY3V0ZQd1bmkwMjE4B3VuaTFFOUUGVGNhcm9uB3VuaTAyMUEGVWJyZXZlDVVodW5nYXJ1bWxhdXQHVW1hY3JvbgdVb2dvbmVrBVVyaW5nBldhY3V0ZQtXY2lyY3VtZmxleAlXZGllcmVzaXMGV2dyYXZlC1ljaXJjdW1mbGV4BllncmF2ZQZaYWN1dGUKWmRvdGFjY2VudAZhYnJldmUHYW1hY3Jvbgdhb2dvbmVrCmNkb3RhY2NlbnQGZGNhcm9uBmVjYXJvbgplZG90YWNjZW50B2VtYWNyb24HZW9nb25lawd1bmkwMTIzCmdkb3RhY2NlbnQEaGJhcglpLmxvY2xUUksCaWoHaW1hY3Jvbgdpb2dvbmVrB3VuaTAyMzcLdW5pMDA2QTAzMDEHdW5pMDEzNwZsYWN1dGUGbGNhcm9uB3VuaTAxM0MGbmFjdXRlBm5jYXJvbgd1bmkwMTQ2A2VuZw1vaHVuZ2FydW1sYXV0B29tYWNyb24GcmFjdXRlBnJjYXJvbgd1bmkwMTU3BnNhY3V0ZQd1bmkwMjE5BnRjYXJvbgd1bmkwMjFCBnVicmV2ZQ11aHVuZ2FydW1sYXV0B3VtYWNyb24HdW9nb25lawV1cmluZwZ3YWN1dGULd2NpcmN1bWZsZXgJd2RpZXJlc2lzBndncmF2ZQt5Y2lyY3VtZmxleAZ5Z3JhdmUGemFjdXRlCnpkb3RhY2NlbnQFYS5hbHQHemVyby50ZgZvbmUudGYGdHdvLnRmCHRocmVlLnRmB2ZvdXIudGYHZml2ZS50ZgZzaXgudGYIc2V2ZW4udGYIZWlnaHQudGYHbmluZS50Zgd1bmkyMDBBB3VuaTAwQTAWcGVyaW9kY2VudGVyZWQubG9jbENBVBtwZXJpb2RjZW50ZXJlZC5sb2NsQ0FULmNhc2UHdW5pMjY5OARFdXJvB3VuaTAzMDgHdW5pMDMwNwlncmF2ZWNvbWIJYWN1dGVjb21iB3VuaTAzMEILdW5pMDMwQy5hbHQHdW5pMDMwMgd1bmkwMzBDB3VuaTAzMDYHdW5pMDMwQQl0aWxkZWNvbWIHdW5pMDMwNAd1bmkwMzEyB3VuaTAzMjYHdW5pMDMyNwd1bmkwMzI4DHVuaTAzMDguY2FzZQx1bmkwMzA3LmNhc2UOZ3JhdmVjb21iLmNhc2UOYWN1dGVjb21iLmNhc2UMdW5pMDMwQi5jYXNlDHVuaTAzMDIuY2FzZQx1bmkwMzBDLmNhc2UMdW5pMDMwNi5jYXNlDHVuaTAzMEEuY2FzZQ50aWxkZWNvbWIuY2FzZQx1bmkwMzA0LmNhc2UFcGl4ZWwAAAABAAH//wAPAAEAAgAOAAAAAAAAAMYAAgAeAAEACgABAA0AEgABABQAFAABABYAHgABACAAIwABACYANgABADkAPQABAD8ARQABAEcARwABAEwAVAABAFYAYgABAGQAaAABAGoAfAABAH8AhAABAIYAhgABAIgAkAABAJIAlQABAJkAngABAKAAoQABAKMAqgABAK0AsQABALMAuQABALsAuwABAMAAyAABAMoA1gABANgA3AABAN4A5gABAOgA6QABAS8BLwABAUEBWwADAAEAAQAAAAgAAgACAUEBRQAAAUcBTQAFAAAAAQAAABoACgASAAFtYXJrADYAAwAWAB4AJgACREZMVAAwbGF0bgA0AAQAAAABAGgABAAAAAEAbAAEAAAAAQBwAAAAAwAAAAEAAgA+AAAAOgAJQVpFIAA6Q0FUIAA6Q1JUIAA6S0FaIAA6TU9MIAA6TkxEIAA6Uk9NIAA6VEFUIAA6VFJLIAA6AAD//wABAAAAAQAkAjgAAQBCA74AAQAiARIAAQByAtgAAQAgAJwAAQA4AXwAAQADAU4BTwFQAAIAAQFBAU0AAAACAAEBUQFbAAAAAwAABP4AAAT+AAAE/gALAAAE9gAABPYAAAT2AAAE9gAABPYAAAT2AAAE9gAABPYAAAT2AAAE9gAABPYADQAABM4AAATOAAAEzgAABM4AAATOAAAEzgAABM4AAATOAAAEzgAABM4AAATOAAAEzgAABM4AAgARAAEACgAAAA0AEgAKABQAFAAQABYAHgARACAAIwAaACYAKAAeACsAMAAhADMANgAnADkAPQArAD8ARQAwAEcARwA3AEwAUQA4AFMAVAA+AFYAYgBAAGQAZQBNAGgAaABPAS8BLwBQAAIAEwApACoAAABSAFIAAgBmAGcAAwBqAHwABQB/AIQAGACGAIYAHgCIAJAAHwCSAJUAKACZAJ4ALACgAKEAMgCjAKoANACtALEAPACzALkAQQC7ALsASADAAMgASQDNANYAUgDYANwAXADeAOYAYQDoAOkAagBRA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA+ID4gPcA9wD3APcA9wD3APcA9wD3APcA9wD3APcA8oDvgPKA8oDygPKA8oD0APQA8QDxAPEA8QD1gPWA9YD1gPWA9wD3APcA9wD3APcA9wD3APcA9wD3APcA9YD1gPWA9YD3APcA9wD3APcA9wD3APcA9wD3APcA9wD3APQA9AD0APcAAIAHAABAAoAAAANABEACgAWAB4ADwAgACMAGAAmADYAHAA5AD0ALQA/AEUAMgBHAEcAOQBMAFQAOgBWAGIAQwBkAGgAUABqAHwAVQB/AIQAaACGAIYAbgCIAJAAbwCSAJUAeACZAJ4AfACgAKEAggCjAKoAhACtALEAjACzALkAkQC7ALsAmADAAMgAmQDKANYAogDYANwArwDeAOYAtADoAOkAvQEvAS8AvwBsAnoCegKGAoACgAKGAoYChgKGAoYCjAKMAowCjAK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCtgKYApgCtgK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCtgKeAp4CngKeAp4CngKeAp4CngKeApICkgKkAqQCpAKkArYCtgK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCqgKqAqoCqgK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCtgK2ArYCtgKwArACsAKwArACtgK2ArYCtgK2ArYCtgK2ArYCtgK2AMACEgISAhICEgISAhICEgISAhICEgIYAhgCGAIYAhgB4gHiAeIB4gHiAeIB4gHiAeICGAIYAhgCGAIMAegCDAIMAgwCDAIMAgwCDAIeAh4CHgIeAe4B7gHuAe4B9AH0AfQB9AH0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"
$script:pixelFamily = $null
try {
    $fontBytes = [Convert]::FromBase64String($FontB64)
    $script:pfc = New-Object System.Drawing.Text.PrivateFontCollection
    $fontPtr = [System.Runtime.InteropServices.Marshal]::AllocCoTaskMem($fontBytes.Length)
    [System.Runtime.InteropServices.Marshal]::Copy($fontBytes, 0, $fontPtr, $fontBytes.Length)
    $script:pfc.AddMemoryFont($fontPtr, $fontBytes.Length)
    [System.Runtime.InteropServices.Marshal]::FreeCoTaskMem($fontPtr)
    $script:pixelFamily = $script:pfc.Families[0]
} catch { }

# fonts (point-based, so they scale with the DPI automatically)
$fWordmark = New-Object System.Drawing.Font("Segoe UI Semibold", 12, [System.Drawing.FontStyle]::Bold)
$fEyebrow  = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$fTag      = New-Object System.Drawing.Font("Segoe UI", 10)
$fSection  = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fBtn      = New-Object System.Drawing.Font("Segoe UI Semibold", 10, [System.Drawing.FontStyle]::Bold)
$fRowName  = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$fBadge    = New-Object System.Drawing.Font("Segoe UI", 8.5)
$fFoot     = New-Object System.Drawing.Font("Segoe UI", 8.5)
if ($script:pixelFamily) {
    $fPixelXL = New-Object System.Drawing.Font($script:pixelFamily, 40)
    $fPixelM  = New-Object System.Drawing.Font($script:pixelFamily, 24)
    $fPixelS  = New-Object System.Drawing.Font($script:pixelFamily, 13)
} else {
    $fPixelXL = New-Object System.Drawing.Font("Segoe UI", 30, [System.Drawing.FontStyle]::Bold)
    $fPixelM  = New-Object System.Drawing.Font("Segoe UI", 18, [System.Drawing.FontStyle]::Bold)
    $fPixelS  = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
}

# state shared with event handlers
$script:rowState = @{}
$script:rowCb = @{}
$script:rowBadge = @{}
$script:badgeCtl = @{}
$script:logVirgin = $true

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

# Soft radial glow drawn into an existing Graphics.
function Draw-Glow($g, [int]$x, [int]$y, [int]$w, [int]$h, $color) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddEllipse($x, $y, $w, $h)
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    $brush.CenterColor = $color
    $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B))
    $g.FillPath($brush, $path)
    $brush.Dispose(); $path.Dispose()
}

# Tiny plus-shaped sparkle. Coordinates are expected pre-scaled.
function Draw-Sparkle($g, [int]$x, [int]$y, [int]$r, [int]$alpha) {
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb($alpha, 255, 130, 188), (S 2))
    $pen.StartCap = "Round"
    $pen.EndCap = "Round"
    $g.DrawLine($pen, ($x - $r), $y, ($x + $r), $y)
    $g.DrawLine($pen, $x, ($y - $r), $x, ($y + $r))
    $pen.Dispose()
}

# Custom-painted pill buttons: WinForms regions can't antialias, so every rounded control is
# drawn with GDI+ on a panel whose BackColor matches the form - corners stay buttery smooth.
$script:pillPaint = {
    param($s, $e)
    $d = $s.Tag
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $g.TextRenderingHint = "AntiAliasGridFit"
    $w = $s.Width - 1
    $h = $s.Height - 1
    $col = $d.Back
    if ($d.On -and $d.Hot) { $col = $d.Hover }
    $path = New-RoundedPath 0 0 $w $h $d.Radius
    $b = New-Object System.Drawing.SolidBrush ($col)
    $g.FillPath($b, $path)
    $b.Dispose()
    if ($d.Border) {
        $pen = New-Object System.Drawing.Pen ($cBorder)
        $g.DrawPath($pen, $path)
        $pen.Dispose()
    }
    $path.Dispose()
    $fcol = $d.Fore
    if (-not $d.On) { $fcol = [System.Drawing.Color]::FromArgb(110, $d.Fore.R, $d.Fore.G, $d.Fore.B) }
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = "Center"
    $sf.LineAlignment = "Center"
    $tb = New-Object System.Drawing.SolidBrush ($fcol)
    $g.DrawString($d.Text, $d.Font, $tb, (New-Object System.Drawing.RectangleF(0, 0, $s.Width, $s.Height)), $sf)
    $tb.Dispose(); $sf.Dispose()
}

function New-Pill($text, $back, $hover, $fore, $font, $radius, $border) {
    $p = New-Object System.Windows.Forms.Panel
    # Transparent so the painted form deco shows through the rounded corners.
    $p.BackColor = [System.Drawing.Color]::Transparent
    $p.Cursor = "Hand"
    $p.Tag = @{ Text = $text; Back = $back; Hover = $hover; Fore = $fore; Font = $font; Radius = $radius; Border = $border; Hot = $false; On = $true }
    try {
        $dbp = [System.Windows.Forms.Panel].GetProperty("DoubleBuffered", [System.Reflection.BindingFlags]"Instance,NonPublic")
        $dbp.SetValue($p, $true, $null)
    } catch { }
    $p.Add_Paint($script:pillPaint)
    $p.Add_MouseEnter({ param($s, $e) $s.Tag.Hot = $true; $s.Invalidate() })
    $p.Add_MouseLeave({ param($s, $e) $s.Tag.Hot = $false; $s.Invalidate() })
    return $p
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

        $stateKey = "stNot"
        $indexJs = Join-Path $res "app\index.js"
        if (Test-Path $indexJs) {
            $content = Get-Content $indexJs -Raw -ErrorAction SilentlyContinue
            if ($content -match "Kittycord") { $stateKey = "stInstalled" }
            else { $stateKey = "stOther" }
        }
        $found += [pscustomobject]@{ Name = $b.Name; Proc = $b.Proc; Resources = $res; StateKey = $stateKey }
    }
    return $found
}

# The Microsoft Store version of Discord is a packaged app under WindowsApps; its files are
# read-only and can't be patched. Detect it so we can tell the user instead of "not found".
function Test-MicrosoftStoreDiscord {
    try { return [bool](Get-AppxPackage -Name "*Discord*" -ErrorAction SilentlyContinue | Select-Object -First 1) }
    catch { return $false }
}

# When no patchable install is found, explain exactly why (returns a string table key).
function Get-NoInstallReasonKey {
    if (Test-MicrosoftStoreDiscord) { return "noStore" }
    foreach ($dir in @("Discord", "DiscordPTB", "DiscordCanary")) {
        if (Test-Path (Join-Path $env:LOCALAPPDATA $dir)) { return "noSetup" }
    }
    return "noNone"
}

# Download + patch/unpatch run in a background runspace (see Start-Work below) so the window
# never freezes during the large download.

# ================= UI =================
$form = New-Object System.Windows.Forms.Form
$form.Text = "Kittycord Installer"
$form.ClientSize = New-Object System.Drawing.Size((S 880), (S 660))
$form.StartPosition = "CenterScreen"
$form.FormBorderStyle = "None"
$form.MaximizeBox = $false
$form.BackColor = $cBg
$form.ForeColor = $cText
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)
$form.Add_HandleCreated({ Set-DarkTitlebar $form.Handle })
$form.Add_MouseDown({
    param($s, $e)
    if ($e.Button -eq [System.Windows.Forms.MouseButtons]::Left) { Start-WindowDrag }
})
if ($logo) {
    try { $form.Icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$logo).GetHicon()) } catch { }
}

# Everything editorial (deco shapes, top bar, headline, tagline) is painted straight onto the
# form so it can layer freely, like the reference layout.
$form.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $g.TextRenderingHint = "AntiAliasGridFit"

    # --- background geometry ---
    Draw-Glow $g (S -160) (S -160) (S 520) (S 420) ([System.Drawing.Color]::FromArgb(34, 255, 95, 166))
    Draw-Glow $g (S 470) (S 240) (S 560) (S 480) ([System.Drawing.Color]::FromArgb(26, 255, 95, 166))

    # rotated diamond top-right
    $pts = @(
        (New-Object System.Drawing.Point((S 760), (S -120))),
        (New-Object System.Drawing.Point((S 980), (S 60))),
        (New-Object System.Drawing.Point((S 800), (S 240))),
        (New-Object System.Drawing.Point((S 580), (S 60))))
    $db = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(26, 255, 95, 166))
    $g.FillPolygon($db, $pts)
    $db.Dispose()

    # triangle bottom-left
    $pts2 = @(
        (New-Object System.Drawing.Point((S -80), (S 640))),
        (New-Object System.Drawing.Point((S 220), (S 640))),
        (New-Object System.Drawing.Point((S -80), (S 430))))
    $tb = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 255, 130, 188))
    $g.FillPolygon($tb, $pts2)
    $tb.Dispose()

    # thin sweeping arcs (the crimson "lines" of the reference, in pink)
    $arcPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 255, 95, 166), (S 2))
    $g.DrawArc($arcPen, (S 430), (S -340), (S 760), (S 760), 70, 95)
    $g.DrawArc($arcPen, (S 380), (S -390), (S 880), (S 880), 75, 85)
    $arcPen.Dispose()

    # --- top bar ---
    if ($logo) { $g.DrawImage($logo, (S 28), (S 16), (S 32), (S 32)) }
    $wm = New-Object System.Drawing.SolidBrush ($cText)
    $g.DrawString("Kittycord", $fWordmark, $wm, (S 66), (S 20))
    $wm.Dispose()

    # --- eyebrow + pixel headline + tagline ---
    $eb = New-Object System.Drawing.SolidBrush ($cFaint)
    $g.DrawString((T "eyebrow"), $fEyebrow, $eb, (S 30), (S 64))
    $eb.Dispose()

    $hl1 = New-Object System.Drawing.SolidBrush ($cPink)
    $hl2 = New-Object System.Drawing.SolidBrush ($cText)
    $g.DrawString((T "headline1"), $fPixelXL, $hl1, (S 24), (S 80))
    $g.DrawString((T "headline2"), $fPixelXL, $hl2, (S 24), (S 130))
    $hl1.Dispose(); $hl2.Dispose()

    $tg = New-Object System.Drawing.SolidBrush ($cMuted)
    $g.DrawString((T "tagline"), $fTag, $tg, (New-Object System.Drawing.RectangleF((S 30), (S 192), (S 436), (S 40))))
    $tg.Dispose()

    $ch = New-Object System.Drawing.SolidBrush ($cPink)
    $g.DrawString((T "choose"), $fSection, $ch, (S 28), (S 240))
    $ch.Dispose()
})

# --- GitHub pill + window controls (top right; the window has no native titlebar) ---
$ghBtn = New-Pill "GitHub" $cPanel $cPanel2 $cMuted $fFoot (S 13) $true
$ghBtn.Location = New-Object System.Drawing.Point((S 666), (S 18))
$ghBtn.Size = New-Object System.Drawing.Size((S 86), (S 27))
$ghBtn.Add_Click({ try { Start-Process "https://github.com/$Repo" } catch { } })
$form.Controls.Add($ghBtn)

$btnMin = New-Pill ([string][char]8211) $cPanel $cPanel2 $cMuted $fFoot (S 13) $true
$btnMin.Location = New-Object System.Drawing.Point((S 764), (S 18))
$btnMin.Size = New-Object System.Drawing.Size((S 40), (S 27))
$btnMin.Add_Click({ $form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized })
$form.Controls.Add($btnMin)

$btnClose = New-Pill ([string][char]10005) $cPanel ([System.Drawing.Color]::FromArgb(214, 64, 92)) $cText $fFoot (S 13) $true
$btnClose.Location = New-Object System.Drawing.Point((S 812), (S 18))
$btnClose.Size = New-Object System.Drawing.Size((S 40), (S 27))
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# --- install rows ---
$toggle = {
    param($s, $e)
    $idx = [int]$s.Tag
    $script:rowState[$idx] = -not $script:rowState[$idx]
    $script:rowCb[$idx].Invalidate()
}

$script:rowHover = @{}
function Set-RowHover($row, $on) {
    $idx = [int]$row.Tag
    $script:rowHover[$idx] = $on
    $col = $cPanel
    if ($on) { $col = $cPanel2 }
    foreach ($c in $row.Controls) { $c.BackColor = $col }
    $row.Invalidate()
}

# rows paint their own rounded background (BackColor stays the form color for smooth corners)
$rowPaint = {
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $col = $cPanel
    if ($script:rowHover[[int]$s.Tag]) { $col = $cPanel2 }
    $b = New-Object System.Drawing.SolidBrush ($col)
    $path = New-RoundedPath 0 0 ($s.Width - 1) ($s.Height - 1) (S 10)
    $g.FillPath($b, $path)
    $b.Dispose(); $path.Dispose()
}
$rowEnter = {
    param($s, $e)
    $r = $s
    if (-not ($r.Parent -is [System.Windows.Forms.Form])) { $r = $r.Parent }
    Set-RowHover $r $true
}
$rowLeave = {
    param($s, $e)
    $r = $s
    if (-not ($r.Parent -is [System.Windows.Forms.Form])) { $r = $r.Parent }
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
    $g.DrawString((T $d.Key), $fBadge, $tb, (New-Object System.Drawing.RectangleF(0, 0, $s.Width, $s.Height)), $sf)
    $tb.Dispose(); $sf.Dispose()
}

$installs = @(Get-DiscordInstalls)
$script:emptyLbl = $null
$script:emptyKey = $null
if ($installs.Count -eq 0) {
    $emptyCard = New-Object System.Windows.Forms.Panel
    $emptyCard.Location = New-Object System.Drawing.Point((S 28), (S 268))
    $emptyCard.Size = New-Object System.Drawing.Size((S 440), (S 118))
    $emptyCard.BackColor = [System.Drawing.Color]::Transparent
    $emptyCard.Add_Paint({
        param($s, $e)
        $g = $e.Graphics
        $g.SmoothingMode = "AntiAlias"
        $b = New-Object System.Drawing.SolidBrush ($cPanel)
        $path = New-RoundedPath 0 0 ($s.Width - 1) ($s.Height - 1) (S 12)
        $g.FillPath($b, $path)
        $b.Dispose(); $path.Dispose()
    })
    $form.Controls.Add($emptyCard)

    $script:emptyKey = Get-NoInstallReasonKey
    $empty = New-Object System.Windows.Forms.Label
    $empty.Text = (T $script:emptyKey)
    $empty.ForeColor = $cMuted
    $empty.BackColor = $cPanel
    $empty.AutoSize = $false
    $empty.Size = New-Object System.Drawing.Size((S 412), (S 96))
    $empty.Location = New-Object System.Drawing.Point((S 14), (S 11))
    $emptyCard.Controls.Add($empty)
    $script:emptyLbl = $empty
} else {
    $rowY = 268
    for ($idx = 0; $idx -lt $installs.Count; $idx++) {
        $i = $installs[$idx]
        $script:rowState[$idx] = $true

        $row = New-Object System.Windows.Forms.Panel
        $row.Size = New-Object System.Drawing.Size((S 440), (S 36))
        $row.Location = New-Object System.Drawing.Point((S 28), (S $rowY))
        $row.BackColor = [System.Drawing.Color]::Transparent
        $row.Tag = $idx
        $row.Cursor = "Hand"
        $row.Add_Paint($rowPaint)
        $row.Add_Click($toggle)
        $row.Add_MouseEnter($rowEnter)
        $row.Add_MouseLeave($rowLeave)
        $form.Controls.Add($row)

        $cb = New-Object System.Windows.Forms.Panel
        $cb.Size = New-Object System.Drawing.Size((S 18), (S 18))
        $cb.Location = New-Object System.Drawing.Point((S 12), (S 9))
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
                $b = New-Object System.Drawing.SolidBrush ($cPink)
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
        $nameLbl.Location = New-Object System.Drawing.Point((S 40), (S 9))
        $nameLbl.Tag = $idx
        $nameLbl.Cursor = "Hand"
        $nameLbl.Add_Click($toggle)
        $nameLbl.Add_MouseEnter($rowEnter)
        $nameLbl.Add_MouseLeave($rowLeave)
        $row.Controls.Add($nameLbl)

        $badgeBack = $cPanel2
        $badgeFore = $cMuted
        if ($i.StateKey -eq "stInstalled") { $badgeBack = $cPink; $badgeFore = [System.Drawing.Color]::White }
        elseif ($i.StateKey -eq "stOther") { $badgeBack = [System.Drawing.Color]::FromArgb(124, 92, 160); $badgeFore = [System.Drawing.Color]::White }
        $script:rowBadge[$idx] = @{ Key = $i.StateKey; Back = $badgeBack; Fore = $badgeFore }

        $badge = New-Object System.Windows.Forms.Panel
        $badge.Size = New-Object System.Drawing.Size((S 40), (S 20))
        $badge.Location = New-Object System.Drawing.Point((S 380), (S 8))
        $badge.BackColor = $cPanel
        $badge.Tag = $idx
        $badge.Cursor = "Hand"
        $badge.Add_Click($toggle)
        $badge.Add_MouseEnter($rowEnter)
        $badge.Add_MouseLeave($rowLeave)
        $badge.Add_Paint($badgePaint)
        $row.Controls.Add($badge)
        $script:badgeCtl[$idx] = $badge

        $rowY += 44
    }
}

# --- buttons ---
$btnInstall = New-Pill "" $cPink $cPinkHi ([System.Drawing.Color]::White) $fBtn (S 12) $false
$btnInstall.Location = New-Object System.Drawing.Point((S 28), (S 480))
$btnInstall.Size = New-Object System.Drawing.Size((S 140), (S 44))
$form.Controls.Add($btnInstall)

$btnRepair = New-Pill "" $cPanel $cPanel2 $cText $fBtn (S 12) $true
$btnRepair.Location = New-Object System.Drawing.Point((S 178), (S 480))
$btnRepair.Size = New-Object System.Drawing.Size((S 160), (S 44))
$form.Controls.Add($btnRepair)

$btnUninstall = New-Pill "" $cPanel $cPanel2 $cRedHi $fBtn (S 12) $true
$btnUninstall.Location = New-Object System.Drawing.Point((S 348), (S 480))
$btnUninstall.Size = New-Object System.Drawing.Size((S 120), (S 44))
$form.Controls.Add($btnUninstall)

# --- creator code (optional referral; written to %APPDATA%\Kittycord\referral.json on install) ---
$lblCode = New-Object System.Windows.Forms.Label
$lblCode.AutoSize = $true
$lblCode.BackColor = [System.Drawing.Color]::Transparent
$lblCode.ForeColor = $cMuted
$lblCode.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$lblCode.Location = New-Object System.Drawing.Point((S 28), (S 420))
$form.Controls.Add($lblCode)

$txtCode = New-Object System.Windows.Forms.TextBox
$txtCode.Location = New-Object System.Drawing.Point((S 28), (S 442))
$txtCode.Size = New-Object System.Drawing.Size((S 440), (S 26))
$txtCode.MaxLength = 20
$txtCode.BackColor = $cPanel
$txtCode.ForeColor = $cText
$txtCode.BorderStyle = "FixedSingle"
$txtCode.Font = New-Object System.Drawing.Font("Segoe UI", 10)
$form.Controls.Add($txtCode)

# --- progress bar (custom painted, driven by the background worker) ---
$progress = New-Object System.Windows.Forms.Panel
$progress.Location = New-Object System.Drawing.Point((S 28), (S 538))
$progress.Size = New-Object System.Drawing.Size((S 440), (S 18))
$progress.BackColor = [System.Drawing.Color]::Transparent
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
    $tb = New-Object System.Drawing.SolidBrush ($cPanel)
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
        $g.DrawString($txt, $fBadge, $tw, (New-Object System.Drawing.RectangleF(0, 0, $s.Width, $s.Height)), $sf)
        $tw.Dispose(); $sf.Dispose()
    }
})
$form.Controls.Add($progress)

# --- status log (borderless TextBox inside a rounded card) ---
$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point((S 28), (S 564))
$statusCard.Size = New-Object System.Drawing.Size((S 440), (S 56))
$statusCard.BackColor = [System.Drawing.Color]::Transparent
$statusCard.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $path = New-RoundedPath 0 0 ($s.Width - 1) ($s.Height - 1) (S 10)
    $b = New-Object System.Drawing.SolidBrush ($cPanel)
    $g.FillPath($b, $path)
    $pen = New-Object System.Drawing.Pen ($cBorder)
    $g.DrawPath($pen, $path)
    $b.Dispose(); $pen.Dispose(); $path.Dispose()
})
$form.Controls.Add($statusCard)

$status = New-Object System.Windows.Forms.TextBox
$status.Location = New-Object System.Drawing.Point((S 12), (S 8))
$status.Size = New-Object System.Drawing.Size((S 416), (S 40))
$status.Multiline = $true
$status.ReadOnly = $true
$status.TabStop = $false
$status.HideSelection = $true
$status.ScrollBars = "None"
$status.BackColor = $cPanel
$status.ForeColor = $cMuted
$status.BorderStyle = "None"
$status.Font = New-Object System.Drawing.Font("Consolas", 8.5)
$statusCard.Controls.Add($status)

# --- artwork card (right column) ---
$art = New-Object System.Windows.Forms.Panel
$art.Location = New-Object System.Drawing.Point((S 496), (S 64))
$art.Size = New-Object System.Drawing.Size((S 356), (S 556))
$art.BackColor = [System.Drawing.Color]::Transparent
try {
    $dbProp2 = [System.Windows.Forms.Panel].GetProperty("DoubleBuffered", [System.Reflection.BindingFlags]"Instance,NonPublic")
    $dbProp2.SetValue($art, $true, $null)
} catch { }
$art.Add_Paint({
    param($s, $e)
    $g = $e.Graphics
    $g.SmoothingMode = "AntiAlias"
    $g.TextRenderingHint = "AntiAliasGridFit"
    $w = $s.Width
    $h = $s.Height

    # rounded card filled with a vertical gradient; the inner artwork is clipped to the card
    $card = New-RoundedPath 0 0 ($w - 1) ($h - 1) (S 18)
    $rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
    $gb = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(58, 32, 46),
        [System.Drawing.Color]::FromArgb(26, 14, 20), 90)
    $g.FillPath($gb, $card)
    $gb.Dispose()
    $g.SetClip($card)

    # geometry inside the card
    $pts = @(
        (New-Object System.Drawing.Point([int]($w * 0.55), 0)),
        (New-Object System.Drawing.Point($w, 0)),
        (New-Object System.Drawing.Point($w, [int]($h * 0.4))))
    $pb = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 255, 95, 166))
    $g.FillPolygon($pb, $pts)
    $pb.Dispose()
    $pts2 = @(
        (New-Object System.Drawing.Point(0, $h)),
        (New-Object System.Drawing.Point(0, [int]($h * 0.72))),
        (New-Object System.Drawing.Point([int]($w * 0.45), $h)))
    $pb2 = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(22, 255, 130, 188))
    $g.FillPolygon($pb2, $pts2)
    $pb2.Dispose()

    # glow + mascot
    Draw-Glow $g ([int]($w / 2) - (S 130)) (S 60) (S 260) (S 260) ([System.Drawing.Color]::FromArgb(80, 255, 95, 166))
    if ($logo) { $g.DrawImage($logo, ([int]($w / 2) - (S 88)), (S 96), (S 176), (S 176)) }

    Draw-Sparkle $g (S 60) (S 80) (S 5) 200
    Draw-Sparkle $g (S 296) (S 120) (S 4) 150
    Draw-Sparkle $g (S 70) (S 300) (S 3) 130
    Draw-Sparkle $g (S 290) (S 330) (S 6) 180

    # pixel wordmark + sub line
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = "Center"
    $p1 = New-Object System.Drawing.SolidBrush ($cPink)
    $g.DrawString("KITTYCORD", $fPixelM, $p1, (New-Object System.Drawing.RectangleF(0, (S 306), $w, (S 50))), $sf)
    $p1.Dispose()
    $p2 = New-Object System.Drawing.SolidBrush ($cMuted)
    $g.DrawString("plugins - themes - pink", $fPixelS, $p2, (New-Object System.Drawing.RectangleF(0, (S 348), $w, (S 30))), $sf)
    $p2.Dispose()
    $sf.Dispose()

    # border
    $g.ResetClip()
    $pen = New-Object System.Drawing.Pen ($cBorder)
    $g.DrawPath($pen, $card)
    $pen.Dispose(); $card.Dispose()
})
$form.Controls.Add($art)

# --- footer: language picker (custom pill + dark dropdown menu) + ToS note ---
$langBtn = New-Pill "" $cPanel $cPanel2 $cText $fFoot (S 13) $true
$langBtn.Location = New-Object System.Drawing.Point((S 28), (S 628))
$langBtn.Size = New-Object System.Drawing.Size((S 118), (S 26))
$form.Controls.Add($langBtn)

$langMenu = New-Object System.Windows.Forms.ContextMenuStrip
$langMenu.ShowImageMargin = $false
$langMenu.Font = $fFoot
if ($script:darkMenuOk) {
    try { $langMenu.Renderer = New-Object System.Windows.Forms.ToolStripProfessionalRenderer (New-Object KittycordMenuColors) } catch { }
}
for ($li = 0; $li -lt $script:LangCodes.Count; $li++) {
    $item = $langMenu.Items.Add($script:LangNames[$li])
    $item.ForeColor = $cText
    $item.Tag = $script:LangCodes[$li]
    $item.Add_Click({
        param($s, $e)
        $script:Lang = [string]$s.Tag
        Update-Language
    })
}
$langBtn.Add_Click({
    $langMenu.Show($langBtn, (New-Object System.Drawing.Point(0, 0)), [System.Windows.Forms.ToolStripDropDownDirection]::AboveRight)
})

$footNote = New-Object System.Windows.Forms.Label
$footNote.AutoSize = $true
$footNote.BackColor = [System.Drawing.Color]::Transparent
$footNote.ForeColor = $cFaint
$footNote.Font = $fFoot
$footNote.Location = New-Object System.Drawing.Point((S 152), (S 634))
$form.Controls.Add($footNote)

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
    foreach ($b in @($btnInstall, $btnRepair, $btnUninstall)) {
        $b.Tag.On = -not $busy
        $b.Invalidate()
    }
    if ($busy) { $form.Cursor = "WaitCursor" } else { $form.Cursor = "Default" }
}

# Re-apply every localized text (called at startup and when the language changes).
function Update-Language {
    $btnInstall.Tag.Text = (T "btnInstall")
    $btnRepair.Tag.Text = (T "btnRepair")
    $btnUninstall.Tag.Text = (T "btnUninstall")
    $lblCode.Text = (T "creatorCode")
    $btnInstall.Invalidate(); $btnRepair.Invalidate(); $btnUninstall.Invalidate()
    $langBtn.Tag.Text = $script:LangNames[[array]::IndexOf($script:LangCodes, $script:Lang)] + "  " + [string][char]9662
    $langBtn.Invalidate()
    $footNote.Text = "Kittycord (c) 2026   -   " + (T "toS")
    if ($script:emptyLbl) { $script:emptyLbl.Text = (T $script:emptyKey) }
    foreach ($k in $script:badgeCtl.Keys) {
        $b = $script:badgeCtl[$k]
        $d = $script:rowBadge[$k]
        $tw = [System.Windows.Forms.TextRenderer]::MeasureText((T $d.Key), $fBadge).Width + (S 18)
        $b.Width = $tw
        $b.Left = $b.Parent.Width - $tw - (S 12)
        $b.Invalidate()
    }
    if ($script:logVirgin) {
        $status.Clear()
        Write-Status (T "ready")
    }
    $form.Invalidate()
    $art.Invalidate()
}

# --- background worker: keeps the UI responsive (no "Not Responding") ---
# All heavy work (download + patch/unpatch) runs in a separate runspace; a UI timer drains its
# log queue, repaints the progress bar and finalises when it's done. The worker gets a snapshot
# of the localized strings ($L) so its log lines match the chosen language.
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
            $script:dlErr = $L.errNoFile
            return $false
        }
        if ((Get-Item $AsarPath).Length -le 500000) {
            $script:dlErr = $L.errTooSmall
            return $false
        }
        if ($expected) {
            $actual = (Get-FileHash -Path $AsarPath -Algorithm SHA256).Hash.ToLower()
            if ($actual -ne $expected) {
                $script:dlErr = $L.errChecksum
                Remove-Item $AsarPath -Force -ErrorAction SilentlyContinue
                return $false
            }
            Log $L.logChecksumOk
        } else {
            Log $L.logChecksumNone
        }
        return $true
    }

    try {
        if ($mode -eq "install") {
            Log $L.logDownloading
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
            New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
            $expected = Get-ExpectedHash
            $ok = $false
            $script:dlErr = "?"

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
                                $st.Note = ($L.noteDownload -f $pct, ([Math]::Round($sum / 1MB, 1)), ([Math]::Round($total / 1MB, 1)))
                            }
                        } else {
                            $mb = [Math]::Round($sum / 1MB, 1)
                            if ($mb -ne $lastMb) { $lastMb = $mb; $st.Note = ($L.noteDownloadMb -f $mb) }
                        }
                    }
                    $outStream.Close(); $inStream.Close(); $resp.Close()
                    Log ($L.logDownloaded -f ([Math]::Round($sum / 1MB, 1)))
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
                    Log $L.logRetryCurl
                    $st.Pct = 0
                    $st.Note = $L.noteRetry
                    & $curl -L --fail --silent --show-error -A Kittycord-Installer -o $AsarPath $AsarUrl 2>$null
                    $ok = Test-AsarFile $expected
                }
            }
            if (-not $ok) {
                Log ($L.logDownloadFailed -f $script:dlErr)
                $st.Note = $L.noteFailed
                $st.Ok = $false
                return
            }
            $st.Pct = 100
            $st.Note = $L.notePatching
            Log $L.logPatching
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
                    Log ($L.logPatched -f $i.Name)
                } catch { Log ($L.logErrPatch -f $i.Name, $_.Exception.Message); $st.Ok = $false }
            }
            # Relaunch the patched Discord(s) so the user sees Kittycord immediately - no manual restart.
            foreach ($i in $sel) {
                try {
                    $updateExe = Join-Path $i.Resources "..\..\Update.exe"
                    if (Test-Path $updateExe) {
                        Start-Process -FilePath $updateExe -ArgumentList "--processStart", ($i.Proc + ".exe")
                        Log ($L.logRestarting -f $i.Name)
                    }
                } catch { }
            }
            $st.Note = $L.noteDone
            Log $L.logDoneInstall
        } else {
            $st.Note = $L.noteRemoving
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
                    Log ($L.logReverted -f $i.Name)
                } catch { Log ($L.logErrRevert -f $i.Name, $_.Exception.Message); $st.Ok = $false }
            }
            $st.Note = $L.noteDone
            Log $L.logDoneUninstall
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
            [System.Windows.Forms.MessageBox]::Show((T "msgError"), "Kittycord", "OK", "Warning") | Out-Null
        }
    }
})

function Start-Work($mode, $sel) {
    $script:work.Done = $false
    $script:work.Ok = $true
    $script:work.Pct = 0
    $script:work.Note = ""
    $script:logVirgin = $false
    # snapshot of the localized strings the worker needs
    $L = @{}
    foreach ($k in @("logDownloading", "noteDownload", "noteDownloadMb", "logDownloaded", "logChecksumOk",
            "logChecksumNone", "logRetryCurl", "noteRetry", "logDownloadFailed", "noteFailed", "notePatching",
            "logPatching", "logPatched", "logErrPatch", "logRestarting", "noteDone", "logDoneInstall",
            "noteRemoving", "logReverted", "logErrRevert", "logDoneUninstall", "errChecksum", "errTooSmall",
            "errNoFile")) {
        $L[$k] = (T $k)
    }
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
    $rs.SessionStateProxy.SetVariable("L", $L)
    $ps = [PowerShell]::Create()
    $ps.Runspace = $rs
    [void]$ps.AddScript($workerBody)
    $script:wps = $ps
    $script:wrs = $rs
    $script:whandle = $ps.BeginInvoke()
    $script:poll.Start()
}

# Writes the optional creator code to %APPDATA%\Kittycord\referral.json (Roaming — the same data dir
# the client reads). On the new user's first run the client claims it for the code's owner.
function Save-CreatorCode {
    try {
        $code = $txtCode.Text.Trim().ToLower()
        if ($code -match '^[a-z0-9_-]{3,20}$') {
            $dir = Join-Path $env:APPDATA "Kittycord"
            if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
            $ts = [int64]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
            $json = '{"code":"' + $code + '","ts":' + $ts + '}'
            Set-Content -Path (Join-Path $dir "referral.json") -Value $json -Encoding UTF8
        }
    } catch { }
}

$btnInstall.Add_Click({
    if (-not $btnInstall.Tag.On) { return }
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status (T "selectFirst"); return }
    Save-CreatorCode
    Set-Busy $true
    $script:doneMsg = (T "msgDoneInstall")
    Start-Work "install" $sel
})
$btnRepair.Add_Click({
    if (-not $btnRepair.Tag.On) { return }
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status (T "selectFirst"); return }
    Set-Busy $true
    $script:doneMsg = (T "msgDoneInstall")
    Start-Work "install" $sel
})
$btnUninstall.Add_Click({
    if (-not $btnUninstall.Tag.On) { return }
    $sel = Get-Selected
    if ($sel.Count -eq 0) { Write-Status (T "selectFirst"); return }
    Set-Busy $true
    $script:doneMsg = (T "msgDoneUninstall")
    Start-Work "uninstall" $sel
})

$form.Add_Shown({
    Update-Language
})

try {
    [System.Windows.Forms.Application]::Run($form)
} catch {
    [System.Windows.Forms.MessageBox]::Show("Kittycord installer error:`n$($_.Exception.Message)", "Kittycord", "OK", "Error") | Out-Null
}
