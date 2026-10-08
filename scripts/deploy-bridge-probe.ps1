[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory = $true)]
    [string]$GamePath,
    [switch]$SessionDiagnostic,
    [switch]$RemoveSessionDiagnostic,
    [switch]$RandomSourceDiagnostic,
    [switch]$RemoveRandomSourceDiagnostic,
    [switch]$IdentityDiagnostic,
    [switch]$RemoveIdentityDiagnostic
)

$ErrorActionPreference = 'Stop'
if ($SessionDiagnostic -and $RemoveSessionDiagnostic) { throw 'Choose either SessionDiagnostic or RemoveSessionDiagnostic.' }
if ($RandomSourceDiagnostic -and $RemoveRandomSourceDiagnostic) { throw 'Choose either RandomSourceDiagnostic or RemoveRandomSourceDiagnostic.' }
if ($IdentityDiagnostic -and $RemoveIdentityDiagnostic) { throw 'Choose either IdentityDiagnostic or RemoveIdentityDiagnostic.' }
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
            if ($child.PSIsContainer -or $child.Name -notin @('LifeSigns_BridgeProbe.xml', 'LifeSigns_SessionDiagnostic.xml', 'LifeSigns_RandomSourceDiagnostic.xml', 'LifeSigns_IdentityDiagnostic.xml')) {
                throw "Unexpected existing MD content: $($child.Name)"
            }
            if ($child.Name -eq 'LifeSigns_SessionDiagnostic.xml' -and -not ($SessionDiagnostic -or $RemoveSessionDiagnostic)) {
                throw 'Session diagnostic is installed. Explicitly choose -SessionDiagnostic to retain it or -RemoveSessionDiagnostic to remove it.'
            }
            if ($child.Name -eq 'LifeSigns_RandomSourceDiagnostic.xml' -and -not ($RandomSourceDiagnostic -or $RemoveRandomSourceDiagnostic)) {
                throw 'Random source diagnostic is installed. Explicitly choose -RandomSourceDiagnostic to retain it or -RemoveRandomSourceDiagnostic to remove it.'
            }
            if ($child.Name -eq 'LifeSigns_IdentityDiagnostic.xml' -and -not ($IdentityDiagnostic -or $RemoveIdentityDiagnostic)) {
                throw 'Identity diagnostic is installed. Explicitly choose -IdentityDiagnostic to retain it or -RemoveIdentityDiagnostic to remove it.'
            }
        }
    }
}

if ($PSCmdlet.ShouldProcess($target, "Deploy Life Signs docking probe (SessionDiagnostic=$SessionDiagnostic, RemoveSessionDiagnostic=$RemoveSessionDiagnostic, RandomSourceDiagnostic=$RandomSourceDiagnostic, RemoveRandomSourceDiagnostic=$RemoveRandomSourceDiagnostic, IdentityDiagnostic=$IdentityDiagnostic, RemoveIdentityDiagnostic=$RemoveIdentityDiagnostic)")) {
    New-Item -ItemType Directory -Path (Join-Path $target 'md') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $source 'content.xml') -Destination (Join-Path $target 'content.xml') -Force
    Copy-Item -LiteralPath (Join-Path $source 'md\LifeSigns_BridgeProbe.xml') -Destination (Join-Path $target 'md\LifeSigns_BridgeProbe.xml') -Force
    $diagnostic = Join-Path $target 'md\LifeSigns_SessionDiagnostic.xml'
    if ($SessionDiagnostic) {
        Copy-Item -LiteralPath (Join-Path $source 'md\LifeSigns_SessionDiagnostic.xml') -Destination $diagnostic -Force
    }
    if ($RemoveSessionDiagnostic -and (Test-Path -LiteralPath $diagnostic)) {
        Remove-Item -LiteralPath $diagnostic
    }
    $randomDiagnostic = Join-Path $target 'md\LifeSigns_RandomSourceDiagnostic.xml'
    if ($RandomSourceDiagnostic) {
        Copy-Item -LiteralPath (Join-Path $source 'md\LifeSigns_RandomSourceDiagnostic.xml') -Destination $randomDiagnostic -Force
    }
    if ($RemoveRandomSourceDiagnostic -and (Test-Path -LiteralPath $randomDiagnostic)) {
        Remove-Item -LiteralPath $randomDiagnostic
    }
    $identityDiagnosticPath = Join-Path $target 'md\LifeSigns_IdentityDiagnostic.xml'
    if ($IdentityDiagnostic) {
        Copy-Item -LiteralPath (Join-Path $source 'md\LifeSigns_IdentityDiagnostic.xml') -Destination $identityDiagnosticPath -Force
    }
    if ($RemoveIdentityDiagnostic -and (Test-Path -LiteralPath $identityDiagnosticPath)) {
        Remove-Item -LiteralPath $identityDiagnosticPath
    }
    Write-Output "Deployed probe to $target"
}
