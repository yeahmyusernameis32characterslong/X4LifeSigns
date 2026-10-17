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

[xml]$source = Get-Content -LiteralPath (Join-Path $schemas 'common.xsd')
$ns = New-Object System.Xml.XmlNamespaceManager($source.NameTable)
$ns.AddNamespace('xs', 'http://www.w3.org/2001/XMLSchema')
[xml]$generated = Get-Content -LiteralPath $file
$listeners = @($generated.SelectNodes('//cue[starts-with(@name,"Listen")]/conditions/*'))
foreach ($event in $listeners) {
    $definition = $source.SelectSingleNode("//xs:element[@name='$($event.Name)']", $ns)
    if (-not $definition) { throw "Unknown event: $($event.Name)" }
    $sourceGroup = $definition.SelectSingleNode('.//xs:attributeGroup[@ref="objecteventsource"]', $ns)
    if ($event.HasAttribute('group') -and -not $sourceGroup) { throw "Unsupported group selector: $($event.Name)" }
    if ($sourceGroup -and -not ($event.HasAttribute('object') -or $event.HasAttribute('group'))) { throw "Unbound object event: $($event.Name)" }
    foreach ($required in $definition.SelectNodes('.//xs:attribute[@use="required"]', $ns)) {
        if (-not $event.HasAttribute($required.name)) { throw "Missing selector $($required.name): $($event.Name)" }
    }
}
Write-Output "Validated generated MD and $($listeners.Count) listener selectors against hash-checked installed X4 9.00 schemas. This is not runtime verification."
