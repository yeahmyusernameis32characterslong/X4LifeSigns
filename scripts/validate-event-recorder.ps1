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
    if ($parameter.GetAttribute('value') -match "^@\s*(null\b|')") { throw 'Invalid optional lookup operator before a literal Value expression.' }
}
$listeners = @($generated.SelectNodes('//*[starts-with(name(),"event_")]'))
if ($listeners.Count -ne 2 -or $listeners[0].LocalName -ne 'event_universe_generated' -or $listeners[1].LocalName -ne 'event_ui_triggered' -or $listeners[1].GetAttribute('screen') -ne "'LifeSignsDatabase'" -or $listeners[1].GetAttribute('control') -ne "'reply'") { throw 'Unexpected database collector listener; review its selector and scope.' }
if ($generated.SelectNodes('//create_npc | //create_npc_template').Count -ne 0) { throw 'Profile collection must not create NPCs.' }
Write-Output 'Validated generated database-aware MD against hash-checked installed X4 9.00 schemas; reviewed universe/database-reply hooks, no NPC creation. This is not runtime verification.'
