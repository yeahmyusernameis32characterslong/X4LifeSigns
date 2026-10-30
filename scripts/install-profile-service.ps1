param(
    [Parameter(Mandatory=$true)][string]$GameRoot,
    [Parameter(Mandatory=$true)][string]$LogDirectory,
    [Parameter(Mandatory=$true)][ValidatePattern('^[0-9a-f]{40}$')][string]$ApprovedCommit,
    [string]$DebugLog,
    [string]$NodeExecutable=(Get-Command node.exe -ErrorAction Stop).Source
)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$sourceRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
function Ordinary([string]$Path) {
    $resolved=[IO.Path]::GetFullPath($Path)
    while ($resolved) {
        $item=Get-Item -LiteralPath $resolved -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (-not $item.PSIsContainer -and $item.LinkType -eq 'HardLink')) { throw 'Linked installation path refused' }
        $resolved=[IO.Path]::GetDirectoryName($resolved)
    }
}
function AssertUnregisteredInstall([string]$Root) {
    # This generic installer rebuilds configuration. Registered production roots
    # require the preservation/rollback procedure, never an unpinned reinstall.
    if (Test-Path -LiteralPath (Join-Path $Root 'local-data/housekeeping-production.json')) {
        throw 'Housekeeping is registered. Use the production upgrade procedure to preserve its registration and anchor.'
    }
    $existing=Join-Path $Root 'local-data/profile-service-lifecycle/config.local.json'
    if (Test-Path -LiteralPath $existing) {
        $config=Get-Content -LiteralPath $existing -Raw | ConvertFrom-Json
        if ($config.PSObject.Properties.Name -contains 'productionRootId' -or $config.PSObject.Properties.Name -contains 'productionAnchor') {
            throw 'Production registration pins exist. Restore or verify registration before upgrading this installation.'
        }
    }
}
AssertUnregisteredInstall $sourceRoot
foreach ($p in @($sourceRoot,$GameRoot,$NodeExecutable)) { Ordinary $p; if ($p -match '["\r\n]') { throw 'Invalid path character' } }
if ((git -C $sourceRoot rev-parse HEAD) -ne $ApprovedCommit -or (git -C $sourceRoot status --porcelain)) { throw 'Approved checkout is not clean/current' }
if ((& $NodeExecutable --version).Trim() -ne 'v24.21.0') { throw 'Expected verified Node24.21.0' }
$gameExecutable=Join-Path ([IO.Path]::GetFullPath($GameRoot)) 'X4.exe'
$extension=Join-Path ([IO.Path]::GetFullPath($GameRoot)) 'extensions/lifesigns_event_recorder'
Ordinary $gameExecutable; Ordinary $extension
[xml]$content=Get-Content -LiteralPath (Join-Path $extension 'content.xml') -Raw
if ($content.content.id -ne 'lifesigns_event_recorder') { throw 'Optional recorder identity mismatch' }
if (Get-Process X4* -ErrorAction SilentlyContinue) { throw 'Close X4 before deployment' }
if (@(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'profiles[/\\]service\.mjs' }).Count) { throw 'Existing profile service must be reconciled before installation' }
if (-not (Test-Path -LiteralPath $LogDirectory -PathType Container)) { throw 'Native log directory missing' }
if (-not $DebugLog) { throw 'Explicit X4 debuglog path required for the experimental load boundary' }
$DebugLog=[IO.Path]::GetFullPath($DebugLog)
# Read-only game input can carry cloud-file reparse attributes without being a
# link/redirection. Use the existing ancestor/realpath/single-link input guard;
# installation destinations continue to use the stricter Ordinary check above.
Push-Location $sourceRoot
try {
    @'
import { checkPath } from './bridge/src/session-path.js';
checkPath(process.argv[2]);
'@ | & $NodeExecutable --input-type=module - $DebugLog
    if ($LASTEXITCODE -ne 0) { throw 'Unsafe or missing debuglog input' }
} finally { Pop-Location }
# Packaging preflight only. Installing the preview dependencies is a separate
# explicit build step; never fetch packages or run npm scripts during deployment.
$bundle=Get-Content -LiteralPath (Join-Path $sourceRoot 'profiles/companion-files.json') -Raw | ConvertFrom-Json
if ($bundle.version -ne 1 -or $bundle.files.Count -ne 37) { throw 'Unexpected companion bundle manifest' }
$files=@($bundle.files)
foreach ($relative in $files) {
    if ($relative -notmatch '^(profiles|recorder|bridge)/[a-zA-Z0-9_./-]+$' -or $relative -match '(^|/)\.\.(/|$)') { throw 'Unsafe companion bundle path' }
    Ordinary (Join-Path $sourceRoot $relative)
}
foreach ($spec in @(@('saxes','6.0.0'),@('xmlchars','2.2.0'))) {
    $dependency=Get-Content -LiteralPath (Join-Path $sourceRoot ('profiles/node_modules/'+$spec[0]+'/package.json')) -Raw | ConvertFrom-Json
    if ($dependency.name -ne $spec[0] -or $dependency.version -ne $spec[1]) { throw 'Run the approved profiles npm ci build step before deployment' }
}
$state=Join-Path $sourceRoot 'local-data/profile-service-lifecycle'
$installs=Join-Path $sourceRoot 'local-data/profile-service-install'
foreach ($p in @($state,$installs)) { if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p | Out-Null }; Ordinary $p }
$startup=[Environment]::GetFolderPath('Startup'); Ordinary $startup
$shortcutPath=Join-Path $startup 'Life Signs SQLite Profiles.lnk'
$shell=New-Object -ComObject WScript.Shell
$marker='Life Signs optional recorder SQLite watcher v1'
if (Test-Path -LiteralPath $shortcutPath) {
    Ordinary $shortcutPath
    $previous=$shell.CreateShortcut($shortcutPath)
    if ($previous.Description -ne $marker) { throw 'Refusing unrelated Startup shortcut' }
}
$oldConfig=Join-Path $state 'config.local.json'
if (Test-Path -LiteralPath $oldConfig) {
    Ordinary $oldConfig
    $prior=Get-Content -LiteralPath $oldConfig -Raw | ConvertFrom-Json
    if ($prior.extensionDirectory -ne $extension -or $prior.databaseRoot -ne $sourceRoot) { throw 'Existing lifecycle configuration belongs elsewhere' }
    # Ask only the watcher recorded for this owned configuration to drain and exit.
    $oldState=Join-Path $state 'watcher-state.local.json'
    if (Test-Path -LiteralPath $oldState) {
        $priorState=Get-Content -LiteralPath $oldState -Raw | ConvertFrom-Json
        $worker=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$priorState.watcherPid)
        if ($worker) {
            if ($worker.CommandLine -notlike ('*'+$oldConfig+'*') -or $worker.CommandLine -notmatch 'watch-x4\.ps1') { throw 'Watcher PID reused; reconcile before replacement' }
            [IO.File]::WriteAllText((Join-Path $state 'stop-watcher.local'),'STOP')
            $deadline=[DateTime]::UtcNow.AddSeconds(30)
            while ((Get-Process -Id $worker.ProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
            if (Get-Process -Id $worker.ProcessId -ErrorAction SilentlyContinue) { throw 'Previous watcher still draining; do not kill it' }
        }
    }
}
$deployment=Join-Path $installs ($ApprovedCommit.Substring(0,12)+'-'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fffffff'))
New-Item -ItemType Directory -Path $deployment | Out-Null
foreach ($p in @($shortcutPath,$oldConfig,(Join-Path $state 'watcher-state.local.json'))) { if (Test-Path -LiteralPath $p) { Copy-Item -LiteralPath $p -Destination (Join-Path $deployment ('prior-'+[IO.Path]::GetFileName($p))) } }
$manifest=@()
foreach ($relative in $files) {
    $from=Join-Path $sourceRoot $relative; Ordinary $from
    $to=Join-Path $deployment $relative
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($to)) | Out-Null
    Copy-Item -LiteralPath $from -Destination $to
    $hash=(Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne (Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant()) { throw 'Companion copy hash mismatch' }
    $manifest+=@{path=$to;sha256=$hash}
}
$config=@{version=1;approvedCommit=$ApprovedCommit;gameExecutable=$gameExecutable;nodeExecutable=[IO.Path]::GetFullPath($NodeExecutable);serviceScript=(Join-Path $deployment 'profiles/service.mjs');databaseRoot=$sourceRoot;logDirectory=[IO.Path]::GetFullPath($LogDirectory);debugLog=$DebugLog;extensionDirectory=$extension;stateDirectory=$state;files=$manifest}
$config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $oldConfig -Encoding UTF8
$stopFile=Join-Path $state 'stop-watcher.local'
if (Test-Path -LiteralPath $stopFile) { Ordinary $stopFile; Remove-Item -LiteralPath $stopFile }
$powershell=Join-Path $PSHOME 'powershell.exe'
$arguments='-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -File "'+(Join-Path $deployment 'profiles/watch-x4.ps1')+'" -Config "'+$oldConfig+'"'
$shortcut=$shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath=$powershell; $shortcut.Arguments=$arguments; $shortcut.WorkingDirectory=$sourceRoot; $shortcut.WindowStyle=7; $shortcut.Description=$marker; $shortcut.Save()
$verify=$shell.CreateShortcut($shortcutPath)
if ($verify.TargetPath -ne $powershell -or $verify.Arguments -ne $arguments -or $verify.Description -ne $marker) { throw 'Startup registration verification failed' }
$watcher=Start-Process -FilePath $powershell -ArgumentList $arguments -WorkingDirectory $sourceRoot -WindowStyle Hidden -PassThru
$deadline=[DateTime]::UtcNow.AddSeconds(10); $ready=$false
while ([DateTime]::UtcNow -lt $deadline) {
    Start-Sleep -Milliseconds 250
    if ($watcher.HasExited) { throw 'Installed watcher exited during startup' }
    $statePath=Join-Path $state 'watcher-state.local.json'
    if (Test-Path -LiteralPath $statePath) {
        try { $current=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json; if ($current.watcherPid -eq $watcher.Id -and $current.status -eq 'IDLE') { $ready=$true; break } } catch { }
    }
}
if (-not $ready) { throw 'Cannot verify idle automatic watcher' }
$receipt=@{status='AUTOMATIC_LIFECYCLE_IDLE_READY';approvedCommit=$ApprovedCommit;watcherPid=$watcher.Id;startupShortcut=$shortcutPath;config=$oldConfig;deployment=$deployment;files=$manifest;utc=[DateTime]::UtcNow.ToString('o')}
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $state 'installed.local.json') -Encoding UTF8
$receipt | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $deployment 'installed.local.json') -Encoding UTF8
@{status=$receipt.status;watcherRunning=$true;sqliteRunning=$false;source=$ApprovedCommit} | ConvertTo-Json
