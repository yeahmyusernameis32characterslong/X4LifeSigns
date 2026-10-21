param([string]$Root,[string]$Repo,[string]$Node)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$fixture=Join-Path $Root 'LifeSignsFixtureGame.exe'
# Use an unchanged Microsoft-signed executable: this PC blocks unsigned test EXEs.
# Only loopback traffic; the fixture has no child processes and never launches X4.
Copy-Item -LiteralPath (Join-Path $env:SystemRoot 'System32/ping.exe') -Destination $fixture
$state=Join-Path $Root 'state';$logs=Join-Path $Root 'logs';$extension=Join-Path $Root 'extension'
foreach($p in @($state,$logs,$extension,(Join-Path $extension 'runtime'))){[IO.Directory]::CreateDirectory($p)|Out-Null}
$config=Join-Path $Root 'config.json'
@{version=1;files=@();gameExecutable=$fixture;nodeExecutable=$Node;serviceScript=(Join-Path $Repo 'profiles/service.mjs');databaseRoot=$Root;logDirectory=$logs;extensionDirectory=$extension;stateDirectory=$state}|ConvertTo-Json|Set-Content $config -Encoding UTF8
$watcherScript=Join-Path $Repo 'profiles/watch-x4.ps1'
$watchArgs='-NoProfile -NonInteractive -WindowStyle Hidden -File "'+$watcherScript+'" -Config "'+$config+'"'
$watcher=$null;$game=$null;$serviceId=$null;$other=$null;$wrongGame=$null
function WaitState([string]$Expected,[int]$Seconds=12){
 $deadline=[DateTime]::UtcNow.AddSeconds($Seconds)
 while([DateTime]::UtcNow -lt $deadline){
  try {$s=Get-Content (Join-Path $state 'watcher-state.local.json') -Raw|ConvertFrom-Json;if($s.status -eq $Expected){return $s}}catch{}
  Start-Sleep -Milliseconds 100
 }
 throw "State $Expected not reached"
}
function WaitGone([int]$ProcessId){
 $deadline=[DateTime]::UtcNow.AddSeconds(12)
 while((Get-Process -Id $ProcessId -ErrorAction SilentlyContinue) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
 if(Get-Process -Id $ProcessId -ErrorAction SilentlyContinue){throw 'Owned child did not close'}
}
function WaitReply([string]$Run,[string]$Expected){
 $file=Join-Path $extension ('runtime/'+$Run+'.reply');$deadline=[DateTime]::UtcNow.AddSeconds(12)
 while([DateTime]::UtcNow -lt $deadline){if((Test-Path $file) -and (Get-Content $file -Raw) -match $Expected){return};Start-Sleep -Milliseconds 100}
 throw 'Expected SQLite reply missing'
}
$universe='lsu1-2026-10-21_12-00-00-1-2-3-4';$run='session-1-2-loaded-2026-10-21_12-00-00'
function Row([int]$Number,[string]$Body,[string]$Run=$run){return 'LSEV1|run='+$Run+'|session=UNAVAILABLE|seq=1|age=1|'+$Body+'|record='+$Number+'|END'}
try {
 $watcher=Start-Process (Join-Path $PSHOME 'powershell.exe') -ArgumentList $watchArgs -WindowStyle Hidden -PassThru -RedirectStandardError (Join-Path $Root 'watcher-stderr.txt') -RedirectStandardOutput (Join-Path $Root 'watcher-stdout.txt')
 $idle=WaitState 'IDLE';if($idle.servicePid){throw 'SQLite running without game'}
 $other=Start-Process (Join-Path $PSHOME 'powershell.exe') -ArgumentList $watchArgs -WindowStyle Hidden -PassThru
 if(-not $other.WaitForExit(8000) -or $other.ExitCode -ne 0){throw 'Duplicate watcher not excluded'}
 $wrongDirectory=Join-Path $Root 'other-install';[IO.Directory]::CreateDirectory($wrongDirectory)|Out-Null
 $wrongExecutable=Join-Path $wrongDirectory 'LifeSignsFixtureGame.exe';Copy-Item -LiteralPath $fixture -Destination $wrongExecutable
 $wrongGame=Start-Process $wrongExecutable -ArgumentList '-t 127.0.0.1' -WindowStyle Hidden -PassThru
 Start-Sleep -Milliseconds 1500
 $s=Get-Content (Join-Path $state 'watcher-state.local.json') -Raw|ConvertFrom-Json
 if($s.status -ne 'IDLE' -or $s.servicePid){throw 'Wrong executable path activated SQLite'}
 Stop-Process -Id $wrongGame.Id;$wrongGame.WaitForExit();$wrongGame=$null
 $game=Start-Process $fixture -ArgumentList '-t 127.0.0.1' -WindowStyle Hidden -PassThru
 $absent=WaitState 'EXTENSION_ABSENT';if($absent.servicePid){throw 'Service started without extension'}
 foreach($name in @('ui.xml','md/LifeSigns_EventRecorder.xml','native/lifesigns_status.dll','ui/addons/ego_detailmonitor/lifesigns_database.lua')){$p=Join-Path $extension $name;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($p))|Out-Null;[IO.File]::WriteAllText($p,'fixture')}
 [IO.File]::WriteAllText((Join-Path $extension 'content.xml'),'<content id="lifesigns_event_recorder" enabled="1"/>')
 $running=WaitState 'SERVICE_RUNNING';$serviceId=[int]$running.servicePid; 'first service started'
 $log=Join-Path $logs ('profiles-'+$run+'.log')
 $rows=@((Row 1 ('RUN_BEGIN|database_protocol=LSDB1|lifesigns_universe_id='+$universe+'|parent_run=NONE|parent_record=0')),(Row 2 'SNAPSHOT_BEGIN'),(Row 3 'PROFILE_BEGIN|profile=1|kind=SHIP'),(Row 4 'VALUE|profile=1|field=seed|type=largeint|state=PRESENT|value=123'),(Row 5 'VALUE|profile=1|field=name|type=string|state=PRESENT|value=Fixture ship'),(Row 6 'PROFILE_END|profile=1|partial=0'),(Row 7 'SNAPSHOT_END|profiles=1'))
 [IO.File]::WriteAllText($log,($rows -join "`n")+"`n")
 WaitReply $run 'READY\|7\|END'
 # Deliberate owned-service crash: restart same game generation, idempotent replay.
 Stop-Process -Id $serviceId
 $deadline=[DateTime]::UtcNow.AddSeconds(12);$restarted=$false
 while([DateTime]::UtcNow -lt $deadline){$s=Get-Content (Join-Path $state 'watcher-state.local.json') -Raw|ConvertFrom-Json;if($s.status -eq 'SERVICE_RUNNING' -and $s.servicePid -ne $serviceId){$serviceId=[int]$s.servicePid;$restarted=$true;break};Start-Sleep -Milliseconds 100}
 if(-not $restarted){throw 'Service did not restart'}; 'service crash recovered'
 WaitReply $run 'READY\|7\|END'
 [IO.File]::AppendAllText($log,(Row 8 'ENTITY_EVENT|event_type=ATTACKED|subject_kind=SHIP|subject_seed=123')+"`n")
 Stop-Process -Id $game.Id;$game.WaitForExit();$game=$null
 $null=WaitState 'IDLE';WaitGone $serviceId; 'game exit drained'
 WaitReply $run 'READY\|8\|END'
 $game=Start-Process $fixture -ArgumentList '-t 127.0.0.1' -WindowStyle Hidden -PassThru
 $running=WaitState 'SERVICE_RUNNING';$serviceId=[int]$running.servicePid; 'second game started'
 # Second process generation must not rewrite old reply while idle.
 Start-Sleep -Milliseconds 400
 WaitReply $run 'READY\|8\|END'
 Remove-Item -LiteralPath (Join-Path $extension 'content.xml')
 $null=WaitState 'EXTENSION_ABSENT';WaitGone $serviceId; 'extension removal stopped'
 [IO.File]::WriteAllText((Join-Path $extension 'content.xml'),'<content id="lifesigns_event_recorder" enabled="1"/>')
 $running=WaitState 'SERVICE_RUNNING';$serviceId=[int]$running.servicePid; 'extension restored'
 # Simulate watcher loss; private pipe EOF must close its service without X4 exit.
 Stop-Process -Id $watcher.Id;$watcher.WaitForExit();$watcher=$null
 WaitGone $serviceId
 'PASS: idle, install gate, duplicate watcher, real SQL baseline, crash/replay, exit/drain, extension removal, orphan EOF'
} finally {
 if($null -ne $wrongGame -and -not $wrongGame.HasExited){Stop-Process -Id $wrongGame.Id}
 if($null -ne $game -and -not $game.HasExited){Stop-Process -Id $game.Id}
 if($null -ne $watcher -and -not $watcher.HasExited){[IO.File]::WriteAllText((Join-Path $state 'stop-watcher.local'),'STOP');if(-not $watcher.WaitForExit(15000)){$watcher.Kill()}}
 if($serviceId){WaitGone $serviceId}
}
