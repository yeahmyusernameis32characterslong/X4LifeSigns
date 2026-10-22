param([Parameter(Mandatory=$true)][string]$Target,[Parameter(Mandatory=$true)][string]$Ready,[Parameter(Mandatory=$true)][string]$Release)
$ErrorActionPreference='Stop'
# Disposable fixture only: deny delete sharing without invoking X4 or a reader.
$stream=[IO.File]::Open($Target,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
try {
    [IO.File]::WriteAllText($Ready,'LOCKED')
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    while(-not (Test-Path -LiteralPath $Release)) {
        if([DateTime]::UtcNow -gt $deadline){throw 'Fixture lock timed out'}
        Start-Sleep -Milliseconds 20
    }
} finally {$stream.Dispose()}
