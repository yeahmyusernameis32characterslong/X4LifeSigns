[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$GamePath
)

$ErrorActionPreference = 'Stop'
$game = (Resolve-Path -LiteralPath $GamePath).ProviderPath
$source = Join-Path (Split-Path $PSScriptRoot -Parent) 'extension'
$extensions = Join-Path $game 'extensions'
$target = Join-Path $extensions 'lifesigns_bridge_probe'

function Assert-NotLinked([string]$Path) {
    if (Test-Path -LiteralPath $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Refusing linked deployment path: $Path"
        }
    }
}

if (-not (Test-Path -LiteralPath (Join-Path $game 'X4.exe') -PathType Leaf)) {
    throw 'GamePath must contain X4.exe.'
}
foreach ($path in @($game, $extensions, $target)) { Assert-NotLinked $path }
[xml]$manifest = Get-Content -LiteralPath (Join-Path $source 'content.xml')
if ($manifest.content.id -ne 'lifesigns_bridge_probe') { throw 'Unexpected source extension identity.' }

if (Test-Path -LiteralPath $target) {
    if (-not (Test-Path -LiteralPath $target -PathType Container)) { throw 'Deployment target is not a folder.' }
    $existingManifest = Join-Path $target 'content.xml'
    Assert-NotLinked $existingManifest
    if (-not (Test-Path -LiteralPath $existingManifest -PathType Leaf)) {
        throw 'Refusing existing folder without the probe manifest.'
    }
    [xml]$existing = Get-Content -LiteralPath $existingManifest
    if ($existing.content.id -ne 'lifesigns_bridge_probe') { throw 'Refusing to overwrite an unrelated extension.' }
    # Check one directory level at a time; never traverse a junction.
    foreach ($item in Get-ChildItem -LiteralPath $target -Force) {
        Assert-NotLinked $item.FullName
        if ($item.Name -eq 'content.xml' -and -not $item.PSIsContainer) { continue }
        if ($item.Name -ne 'md' -or -not $item.PSIsContainer) { throw "Unexpected existing probe content: $($item.Name)" }
        foreach ($child in Get-ChildItem -LiteralPath $item.FullName -Force) {
            Assert-NotLinked $child.FullName
            if ($child.PSIsContainer -or $child.Name -ne 'LifeSigns_BridgeProbe.xml') {
                throw "Unexpected existing MD content: $($child.Name)"
            }
        }
    }
}

if ($PSCmdlet.ShouldProcess($target, 'Deploy Life Signs docking probe (two XML files)')) {
    New-Item -ItemType Directory -Path (Join-Path $target 'md') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $source 'content.xml') -Destination (Join-Path $target 'content.xml') -Force
    Copy-Item -LiteralPath (Join-Path $source 'md\LifeSigns_BridgeProbe.xml') -Destination (Join-Path $target 'md\LifeSigns_BridgeProbe.xml') -Force
    Write-Output "Deployed probe to $target"
}
