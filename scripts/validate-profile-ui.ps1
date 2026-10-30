[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path -LiteralPath $SourceDirectory).Path
$schema = Join-Path $source 'ui/core/addon.xsd'
if ((Get-FileHash -LiteralPath $schema -Algorithm SHA256).Hash -ne '67d318ee4a6892905198519df094b8abe357c84751166e3bc4af2ee19a826cca') { throw 'Extension addon schema changed; reverify source.' }
$extension = Join-Path $root 'extensions/lifesigns_event_recorder'
$file = Join-Path $extension 'ui.xml'
[xml]$addon = Get-Content -LiteralPath $file -Raw
if ($addon.addon.name -ne 'lifesigns_event_recorder' -or $addon.SelectNodes('/addon/environment').Count -ne 1 -or $addon.addon.environment.type -ne 'menus') { throw 'Unexpected extension addon registration.' }
$expectedFiles=@('ui/addons/ego_detailmonitor/lifesigns_database.lua','ui/addons/ego_detailmonitor/lifesigns_housekeeping.lua')
$expectedDependencies=@('ego_detailmonitor','ego_gameoptions')
if (($addon.SelectNodes('/addon/environment/file') | ForEach-Object { $_.name }) -join ',' -cne ($expectedFiles -join ',') -or ($addon.SelectNodes('/addon/environment/dependency') | ForEach-Object { $_.name }) -join ',' -cne ($expectedDependencies -join ',')) { throw 'Unexpected extension files/dependencies.' }
foreach ($relative in $expectedFiles) { if (-not (Test-Path -LiteralPath (Join-Path $extension $relative) -PathType Leaf)) { throw 'Registered Lua file missing.' } }
if (Test-Path -LiteralPath (Join-Path $extension 'ui/addons/ego_detailmonitor/ui.xml')) { throw 'Do not patch the vanilla addon registration.' }
$settings = New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$settings.Schemas.Add($null, $schema) | Out-Null
$settings.add_ValidationEventHandler({ param($sender, $event) throw $event.Message })
$reader = [System.Xml.XmlReader]::Create($file, $settings)
try { while ($reader.Read()) {} } finally { $reader.Dispose() }
Write-Output 'Validated extension-root addon registration, load dependency and Lua presence against installed X4 9.00 addon.xsd. Native loading remains owner-test unverified.'
