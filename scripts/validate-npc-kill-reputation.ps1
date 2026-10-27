[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$SchemaDirectory)
$ErrorActionPreference='Stop'
$repo=Split-Path $PSScriptRoot -Parent
$schemas=(Resolve-Path -LiteralPath $SchemaDirectory).Path
$expected=@{'md.xsd'='9959e42a07bb97225b35c16cede1043c8a55ad418fac22eeaf706642a1650756';'common.xsd'='8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452'}
foreach($name in $expected.Keys){if((Get-FileHash -LiteralPath (Join-Path $schemas $name) -Algorithm SHA256).Hash -ne $expected[$name]){throw ('Reverify changed X4 schema: '+$name)}}
$settings=New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing=[System.Xml.DtdProcessing]::Prohibit
$settings.ValidationType=[System.Xml.ValidationType]::Schema
$settings.Schemas.XmlResolver=New-Object System.Xml.XmlUrlResolver
$settings.Schemas.Add($null,(Join-Path $schemas 'md.xsd'))|Out-Null
$settings.add_ValidationEventHandler({param($sender,$event) throw $event.Message})
$file=Join-Path $repo 'extensions/lifesigns_npc_kill_reputation/md/LifeSigns_NpcKillReputation.xml'
$reader=[System.Xml.XmlReader]::Create($file,$settings)
try{while($reader.Read()){}}finally{$reader.Dispose()}
[xml]$md=Get-Content -LiteralPath $file -Raw
$hooks=@($md.SelectNodes('//*[starts-with(name(),"event_")]'))
if($hooks.Count -ne 1 -or $hooks[0].LocalName -ne 'event_player_owned_killed_object'){throw 'Expected one ownership kill event only'}
if($md.SelectNodes('//transfer_money|//add_faction_relation|//set_faction_relation|//change_relation_on_kill|//event_game_loaded').Count){throw 'Unexpected direct reward mutation or load replay'}
$signals=@($md.SelectNodes('//signal_cue_instantly'))
if($signals.Count -ne 1 -or $signals[0].GetAttribute('cue') -ne 'md.Notifications.AccumulateRewards' -or $signals[0].GetAttribute('param') -ne '[$Best.tradenpc, $Victim, true, false, relationchangereason.destroyedfactionenemy, true, 0]'){throw 'Native reputation-only contract changed'}
[xml]$content=Get-Content -LiteralPath (Join-Path $repo 'extensions/lifesigns_npc_kill_reputation/content.xml') -Raw
if($content.content.id -ne 'lifesigns_npc_kill_reputation' -or $content.content.save -ne '0' -or $content.content.dependency.version -ne '900'){throw 'Unexpected optional extension identity/version'}
Write-Output 'PASS: pinned installed X4 9.00 MD/common schemas, single kill hook and reputation-only native request. Content is well-formed and identity checked; no runtime claim.'
