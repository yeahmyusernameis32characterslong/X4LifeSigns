[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SchemaDirectory,
    [Parameter(Mandatory = $true)][string]$SourceFile
)
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$schemas = (Resolve-Path -LiteralPath $SchemaDirectory).Path
if ((Get-FileHash -LiteralPath (Join-Path $schemas 'aiscripts.xsd') -Algorithm SHA256).Hash -ne '90aaa25ded4fd5a756c19b48178c0b2bdeaa30eb9078d2247072656de0666cb5') { throw 'Reverify changed X4 9.00 AI schema.' }
if ((Get-FileHash -LiteralPath (Join-Path $schemas 'common.xsd') -Algorithm SHA256).Hash -ne '8eec878511d06dd2be88a7054eb54556b29e481bf0feba20fe2cf3c6eabd3452') { throw 'Reverify changed common schema.' }
if ((Get-FileHash -LiteralPath $SourceFile -Algorithm SHA256).Hash -ne 'd1868d85f4556d15a7ad72ba8f300d9bdd6f8d8bcec431109c79057bfe734613') { throw 'Reverify changed X4 9.00 police script.' }
$settings = New-Object System.Xml.XmlReaderSettings
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.ValidationType = [System.Xml.ValidationType]::Schema
$settings.Schemas.XmlResolver = New-Object System.Xml.XmlUrlResolver
$settings.Schemas.Add($null, (Join-Path $schemas 'aiscripts.xsd')) | Out-Null
$settings.add_ValidationEventHandler({ param($sender, $event) throw $event.Message })
function Validate-Xml([string]$xml) {
    $reader = [System.Xml.XmlReader]::Create((New-Object System.IO.StringReader($xml)), $settings)
    try { while ($reader.Read()) {} } finally { $reader.Dispose() }
}
[xml]$source = Get-Content -LiteralPath $SourceFile
$original = $source.OuterXml
Validate-Xml $original
[xml]$diff = Get-Content -LiteralPath (Join-Path $repo 'extensions/lifesigns_event_recorder/aiscripts/order.move.recon.xml')
if (@($diff.diff.ChildNodes | Where-Object { $_.NodeType -eq 'Element' }).Count -ne 2) { throw 'Expected two additions only.' }
$inserted = @()
foreach ($add in $diff.SelectNodes('/diff/add')) {
    $targets = $source.SelectNodes($add.GetAttribute('sel'))
    if ($targets.Count -ne 1) { throw 'Police patch selector must match exactly once.' }
    foreach ($child in $add.ChildNodes) {
        if ($child.NodeType -ne 'Element') { continue }
        if ($child.Name -ne 'do_if' -or $child.GetAttribute('value') -notmatch 'isplayerowned') { throw 'Missing player-only observation guard.' }
        if ($child.SelectNodes('.//*').Count -ne 1 -or $child.FirstChild.Name -ne 'signal_objects') { throw 'Observer must only signal, not mutate game state.' }
        $node = $source.ImportNode($child, $true)
        if ($add.GetAttribute('pos') -eq 'before') { $targets[0].ParentNode.InsertBefore($node, $targets[0]) | Out-Null }
        elseif (-not $add.HasAttribute('pos')) { $targets[0].AppendChild($node) | Out-Null }
        else { throw 'Unsupported patch position.' }
        $inserted += $node
    }
}
if ($inserted.Count -ne 2) { throw 'Expected start and result observations.' }
Validate-Xml $source.OuterXml
foreach ($node in $inserted) { $node.ParentNode.RemoveChild($node) | Out-Null }
if ($source.OuterXml -cne $original) { throw 'Existing AI actions changed.' }
Write-Output 'Validated two player-only observations against hash-checked X4 9.00 AI source/schema; original actions unchanged. No runtime claim.'
