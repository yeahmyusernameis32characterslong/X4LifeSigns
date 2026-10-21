[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$expected = @{
    'ui/addons/ego_detailmonitor/ui.xml' = '7462cc56746d4fb1705477cc0471674c147e33d162d1758f9162eb55cc03a937'
    'ui/core/coreaddon.xsd' = 'dc4b8e04262c8f8b0a1273041b3c2b951e4bec16c375be0ee44409a70330faeb'
}
foreach ($name in $expected.Keys) {
    if ((Get-FileHash -LiteralPath (Join-Path $source $name) -Algorithm SHA256).Hash -ne $expected[$name]) { throw 'UI primary source hash changed; reverify provenance.' }
}
[xml]$base = Get-Content -LiteralPath (Join-Path $source 'ui/addons/ego_detailmonitor/ui.xml') -Raw
[xml]$diff = Get-Content -LiteralPath (Join-Path $root 'extensions/lifesigns_event_recorder/ui/addons/ego_detailmonitor/ui.xml') -Raw
$adds = @($diff.SelectNodes('/diff/add'))
if ($adds.Count -ne 1 -or $adds[0].GetAttribute('sel') -ne "/addon/environment[@type='menus']" -or $adds[0].SelectNodes('file').Count -ne 1 -or $adds[0].file.name -ne 'lifesigns_database.lua') { throw 'Unexpected UI diff scope.' }
$environment = $base.SelectNodes($adds[0].GetAttribute('sel'))
if ($environment.Count -ne 1) { throw 'Expected one menus environment.' }
$environment[0].AppendChild($base.ImportNode($adds[0].SelectSingleNode('file'), $true)) | Out-Null
$settings = New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$settings.Schemas.Add($null, (Join-Path $source 'ui/core/coreaddon.xsd')) | Out-Null
$settings.add_ValidationEventHandler({ param($sender, $event) throw $event.Message })
$text = New-Object System.IO.StringReader($base.OuterXml)
$reader = [System.Xml.XmlReader]::Create($text, $settings)
try { while ($reader.Read()) {} } finally { $reader.Dispose(); $text.Dispose() }
Write-Output 'Validated scoped UI diff merged into hash-verified X4 9.00 addon XML against installed coreaddon schema. Native UI loading remains owner-test unverified.'
