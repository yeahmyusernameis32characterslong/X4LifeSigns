param([Parameter(Mandatory=$true)][string]$Config)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$settings=Get-Content -LiteralPath $Config -Raw | ConvertFrom-Json
if ($settings.version -ne 1) { throw 'Unsupported watcher configuration' }
function VerifyCode {
    foreach ($file in $settings.files) {
        $item=Get-Item -LiteralPath $file.path
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType -eq 'HardLink' -or (Get-FileHash -LiteralPath $file.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.sha256) { throw 'Installed companion code changed; redeploy before running' }
    }
}
VerifyCode
foreach ($key in @('gameExecutable','nodeExecutable','serviceScript','databaseRoot','logDirectory','extensionDirectory','stateDirectory')) {
    $value=[string]$settings.$key
    if (-not [IO.Path]::IsPathRooted($value) -or $value -match '["\r\n]') { throw "Invalid configured path: $key" }
}
$stateDirectory=[IO.Path]::GetFullPath($settings.stateDirectory)
if (-not (Test-Path -LiteralPath $stateDirectory -PathType Container)) { throw 'State directory missing' }
$digest=[Security.Cryptography.SHA256]::Create()
try { $keyHash=([BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes(([IO.Path]::GetFullPath($settings.extensionDirectory)).ToLowerInvariant())))).Replace('-','') } finally { $digest.Dispose() }
$mutex=New-Object Threading.Mutex($false,('Local\LifeSignsProfiles-'+$keyHash))
$owns=$false; $child=$null; $gameKey=$null; $attempts=0; $nextAttempt=[DateTime]::MinValue; $lastState=''; $outTask=$null; $errTask=$null
function State([string]$Status,[string]$Detail='') {
    if ($Status -eq $script:lastState) { return }
    $childId=$null; if ($null -ne $script:child -and -not $script:child.HasExited) { $childId=$script:child.Id }
    $record=@{status=$Status;detail=$Detail;watcherPid=$PID;servicePid=$childId;game=$script:gameKey;utc=[DateTime]::UtcNow.ToString('o')}
    # Status readers must not make the watcher exit on a Windows sharing race.
    try { [IO.File]::AppendAllText((Join-Path $stateDirectory 'lifecycle.local.jsonl'),(($record | ConvertTo-Json -Compress)+[Environment]::NewLine)) } catch { }
    $target=Join-Path $stateDirectory 'watcher-state.local.json'
    $temp=Join-Path $stateDirectory ('state-'+[Guid]::NewGuid().ToString('N')+'.tmp')
    $written=$false
    try {
        [IO.File]::WriteAllText($temp,($record | ConvertTo-Json))
        for ($retry=0; $retry -lt 10; $retry++) {
            try {
                if ([IO.File]::Exists($target)) { [IO.File]::Replace($temp,$target,[NullString]::Value) } else { [IO.File]::Move($temp,$target) }
                $written=$true; break
            } catch [IO.IOException] { Start-Sleep -Milliseconds 20 }
        }
    } catch { }
    finally { if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) } }
    if ($written) { $script:lastState=$Status } else { $script:lastState='' }
}
function Installed {
    $extension=[IO.Path]::GetFullPath($settings.extensionDirectory)
    foreach ($name in @('content.xml','ui.xml','md/LifeSigns_EventRecorder.xml','native/lifesigns_status.dll','ui/addons/ego_detailmonitor/lifesigns_database.lua')) {
        if (-not (Test-Path -LiteralPath (Join-Path $extension $name) -PathType Leaf)) { return $false }
    }
    try { [xml]$content=Get-Content -LiteralPath (Join-Path $extension 'content.xml') -Raw; return $content.content.id -eq 'lifesigns_event_recorder' -and $content.content.enabled -ne '0' }
    catch { return $false }
}
function VerifyRegistration {
    if ($settings.PSObject.Properties.Name -notcontains 'productionRootId') { return }
    $file=Join-Path $settings.databaseRoot 'local-data/housekeeping-production.json'
    $registration=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
    if($registration.id -ne $settings.productionRootId -or $registration.owner -ne 'LifeSignsProductionMaintenance' -or $registration.anchor -ne $settings.productionAnchor){throw 'Production registration missing or changed; recovery required'}
    $anchor=Get-Content -LiteralPath $settings.productionAnchor -Raw|ConvertFrom-Json
    if($anchor.id -ne $settings.productionRootId -or $anchor.root -ne [IO.Path]::GetFullPath($settings.databaseRoot)){throw 'Independent production anchor mismatch'}
}
function FinishChild {
    if ($null -eq $script:child) { return }
    $script:child.WaitForExit()
    $suffix=([DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fffffff'))
    [IO.File]::WriteAllText((Join-Path $stateDirectory ($suffix+'-stdout.local.log')),$script:outTask.Result)
    [IO.File]::WriteAllText((Join-Path $stateDirectory ($suffix+'-stderr.local.log')),$script:errTask.Result)
    $code=$script:child.ExitCode
    $script:child.Dispose(); $script:child=$null
    return $code
}
function StopChild {
    if ($null -eq $script:child) { return }
    State 'DRAINING'
    if (-not $script:child.HasExited) {
        try { $script:child.StandardInput.WriteLine('STOP'); $script:child.StandardInput.Close() } catch { }
    }
    # Never terminate SQLite during a commit. Wait for complete-row drain/close.
    $code=FinishChild
    State 'SERVICE_STOPPED' ('exit='+$code)
}
try {
    try { $owns=$mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owns=$true }
    if (-not $owns) { exit 0 }
    State 'IDLE'
    while (-not (Test-Path -LiteralPath (Join-Path $stateDirectory 'stop-watcher.local'))) {
        $games=@(); $unknown=$false
        foreach ($candidate in [Diagnostics.Process]::GetProcessesByName([IO.Path]::GetFileNameWithoutExtension($settings.gameExecutable))) {
            try {
                if ([string]::Equals($candidate.MainModule.FileName,$settings.gameExecutable,[StringComparison]::OrdinalIgnoreCase)) {
                    $games+=@{id=$candidate.Id;started=$candidate.StartTime.ToUniversalTime()}
                }
            } catch { if (-not $candidate.HasExited) { $unknown=$true } }
            finally { $candidate.Dispose() }
        }
        if ($unknown -or $games.Count -gt 1) { State 'PROCESS_INSPECTION_BLOCKED'; Start-Sleep -Milliseconds 1000; continue }
        $installed=Installed
        $newKey=$null; if ($games.Count -eq 1) { $newKey=([string]$games[0].id)+'@'+$games[0].started.ToString('o') }
        if ($newKey -ne $gameKey -or -not $installed) {
            StopChild
            $gameKey=$newKey; $attempts=0; $nextAttempt=[DateTime]::MinValue
        }
        if ($null -ne $child -and $child.HasExited) {
            $code=FinishChild
            $nextAttempt=[DateTime]::UtcNow.AddSeconds(5)
            State 'SERVICE_EXITED' ('exit='+$code)
        }
        if ($null -ne $gameKey -and $installed -and $null -eq $child -and $attempts -lt 3 -and [DateTime]::UtcNow -ge $nextAttempt) {
            VerifyCode
            VerifyRegistration
            $arguments=@($settings.serviceScript,'--logs',$settings.logDirectory,'--replies',(Join-Path $settings.extensionDirectory 'runtime'),'--since',$games[0].started.ToString('o'),'--control-stdin','--root',$settings.databaseRoot)
            if ($settings.PSObject.Properties.Name -contains 'debugLog') {
                if (-not [IO.Path]::IsPathRooted($settings.debugLog) -or $settings.debugLog -match '["\r\n]') { throw 'Invalid debuglog path' }
                $arguments+=@('--load-control',$settings.debugLog)
            }
            $info=New-Object Diagnostics.ProcessStartInfo
            $info.FileName=$settings.nodeExecutable
            $info.Arguments=($arguments | ForEach-Object { '"'+$_+'"' }) -join ' '
            $info.UseShellExecute=$false; $info.CreateNoWindow=$true
            $info.RedirectStandardInput=$true; $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true
            $info.WorkingDirectory=$settings.databaseRoot
            $child=New-Object Diagnostics.Process; $child.StartInfo=$info
            if (-not $child.Start()) { throw 'Cannot start SQLite service' }
            $outTask=$child.StandardOutput.ReadToEndAsync(); $errTask=$child.StandardError.ReadToEndAsync()
            $attempts++
            State 'SERVICE_RUNNING'
        } elseif ($null -eq $gameKey) { State 'IDLE' }
        elseif (-not $installed) { State 'EXTENSION_ABSENT' }
        elseif ($null -eq $child -and $attempts -ge 3) { State 'SERVICE_RETRY_LIMIT' }
        Start-Sleep -Milliseconds 1000
    }
} finally {
    if ($owns) { StopChild; State 'WATCHER_STOPPED'; $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
