[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SchemaDirectory
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$schemas = (Resolve-Path -LiteralPath $SchemaDirectory).Path
$expected = @{
    'md.xsd' = '9959e42a07bb97225b35c16cede1043c8a55ad418fac22eeaf706642a1650756'
    'common.xsd' = '8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452'
}
foreach ($name in $expected.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $schemas $name) -Algorithm SHA256).Hash -ne $expected[$name]) {
        throw "Schema hash changed: $name. Reverify source before changing this gate."
    }
}
$settings = New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$settings.Schemas.XmlResolver = New-Object System.Xml.XmlUrlResolver
$settings.Schemas.Add($null, (Join-Path $schemas 'md.xsd')) | Out-Null
$settings.add_ValidationEventHandler({ param($sender, $event) throw $event.Message })
$file = Join-Path $repo 'extensions/lifesigns_event_recorder/md/LifeSigns_EventRecorder.xml'
$reader = [System.Xml.XmlReader]::Create($file, $settings)
try { while ($reader.Read()) {} } finally { $reader.Dispose() }

[xml]$generated = Get-Content -LiteralPath $file
foreach ($parameter in $generated.SelectNodes('//param[@name="Value"]')) {
    if ($parameter.GetAttribute('value') -match "^@\s*(null\b|true\b|false\b|')") { throw 'Invalid optional lookup operator before a literal Value expression.' }
}
$listeners = @($generated.SelectNodes('//*[starts-with(name(),"event_")]'))
$catalog = Get-Content -LiteralPath (Join-Path $repo 'recorder/profile-events.json') -Raw | ConvertFrom-Json
if ($listeners.Count -ne (20 + $catalog.Count) -or $listeners[0].LocalName -ne 'event_universe_generated' -or $listeners[1].LocalName -ne 'event_ui_triggered' -or $listeners[1].GetAttribute('screen') -ne "'LifeSignsDatabase'" -or $listeners[1].GetAttribute('control') -ne "'reply'") { throw 'Unexpected database collector listener; review its selector and scope.' }
if ($listeners[4].GetAttribute('screen') -ne "'LifeSignsPersonnel'" -or $listeners[4].GetAttribute('control') -ne "'role_changed'") { throw 'Unexpected personnel observer listener.' }
if ($listeners[3].GetAttribute('screen') -ne "'LifeSignsDatabase'" -or $listeners[3].GetAttribute('control') -ne "'load_error'") { throw 'Unexpected load error listener.' }
if ($listeners[2].GetAttribute('screen') -ne "'LifeSignsDatabase'" -or $listeners[2].GetAttribute('control') -ne "'health'") { throw 'Unexpected database health listener.' }
if ($listeners[5].LocalName -ne 'event_ui_triggered' -or $listeners[5].GetAttribute('screen') -ne "'LifeSignsProfiles'" -or $listeners[5].GetAttribute('control') -ne "'name_changed'") { throw 'Unexpected rename observer listener.' }
if ($listeners[6].LocalName -ne 'event_cue_signalled' -or $listeners[6].GetAttribute('cue') -ne 'ProfileEventBusV2' -or $listeners[-1].LocalName -ne 'event_game_loaded') { throw 'Unexpected staged startup lifecycle.' }
if ($generated.SelectNodes('//cue[@name="ProfileEventBus"]//*[starts-with(name(),"event_")]').Count -ne 0) { throw 'Retired bus must not register listeners.' }
for ($i=0; $i -lt $catalog.Count; $i++) {
    $listener = $listeners[$i+7]
    if ($listener.ParentNode.ParentNode.GetAttribute('name') -ne "ProfileEventV2_$i") { throw 'New listeners must use fresh cue names instead of reparenting saved cues.' }
    if ($listener.LocalName -ne $catalog[$i].name -or $listener.LocalName -match '(shield|hull).*damag') { throw 'Event catalog mismatch or forbidden damage event.' }
    foreach ($selector in $catalog[$i].selector.PSObject.Properties) { if ($listener.GetAttribute($selector.Name) -ne $selector.Value) { throw 'Event selector mismatch.' } }
}
$locks = @($generated.SelectNodes('//cue[@name="CombatLockWatch"]//*[starts-with(name(),"event_lock_")]'))
if ($locks.Count -ne 4) { throw 'Expected four bounded individual-object lock hooks.' }
foreach ($lock in $locks) {
    if ($lock.HasAttribute('group') -or (($lock.GetAttribute('attacker') -ne 'parent.$LockObject') -and ($lock.GetAttribute('target') -ne 'parent.$LockObject'))) { throw 'Lock selector must be an individual watched object.' }
}
$trades = @($generated.SelectNodes('//cue[@name="TradeWatch"]//*[starts-with(name(),"event_trade_")]'))
if ($trades.Count -ne 6) { throw 'Expected six individual-object trade hooks.' }
foreach ($trade in $trades) {
    if ($trade.HasAttribute('space') -or $trade.HasAttribute('group') -or (($trade.GetAttribute('buyer') -ne 'parent.$TradeObject') -and ($trade.GetAttribute('seller') -ne 'parent.$TradeObject'))) { throw 'Trade selector must name the individual player asset.' }
}
if ($generated.SelectNodes('//signal_cue[@param]').Count -ne 0) { throw 'Only signal_cue_instantly can carry a parameter.' }
if ($generated.SelectNodes('//create_npc | //create_npc_template').Count -ne 0) { throw 'Profile collection must not create NPCs.' }
Write-Output 'Validated generated database-aware MD against hash-checked installed X4 9.00 schemas; reviewed universe/database-reply hooks, no NPC creation. This is not runtime verification.'
