[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$locator = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
$installation = & $locator -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if ($LASTEXITCODE -ne 0 -or -not $installation) { throw 'Existing Windows C++ Build Tools required.' }
$setup = Join-Path $installation 'VC/Auxiliary/Build/vcvars64.bat'
$source = Join-Path $root 'profiles/native/lifesigns_status.cpp'
$output = Join-Path $root ('local-data/profile-native-build/'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
New-Item -ItemType Directory -Path $output | Out-Null
foreach ($path in @($setup,$source,$output)) { if ($path.Contains('"')) { throw 'Unsupported quoted path' } }
$command = 'call "'+$setup+'" >nul && cl.exe /nologo /LD /MT /O2 /std:c++20 /EHsc /W4 /WX /guard:cf "'+$source+'" /Fo"'+$output+'\lifesigns_status.obj" /link /DYNAMICBASE /NXCOMPAT /Brepro /OUT:"'+$output+'\lifesigns_status.dll" /IMPLIB:"'+$output+'\lifesigns_status.lib" kernel32.lib'
& $env:ComSpec /d /c $command
if ($LASTEXITCODE -ne 0) { throw 'Native reader build failed.' }
$dll = Join-Path $output 'lifesigns_status.dll'
$inspection = Join-Path $output 'pe-inspection.local.txt'
& $env:ComSpec /d /c ('call "'+$setup+'" >nul && dumpbin.exe /nologo /exports /dependents /headers "'+$dll+'" > "'+$inspection+'"')
if ($LASTEXITCODE -ne 0) { throw 'Native PE inspection failed.' }
$pe = Get-Content -LiteralPath $inspection -Raw
$imports = @([regex]::Matches($pe,'(?im)^\s+([a-z0-9_.-]+\.dll)\s*$') | ForEach-Object {$_.Groups[1].Value.ToLowerInvariant()} | Select-Object -Unique)
if ($imports.Count -ne 1 -or $imports[0] -ne 'kernel32.dll' -or $pe -notmatch '8664 machine' -or $pe -notmatch 'luaopen_lifesigns_status' -or $pe -notmatch 'Dynamic base' -or $pe -notmatch 'NX compatible' -or $pe -notmatch 'Control Flow Guard') { throw 'Unexpected native architecture, exports, dependencies or mitigations.' }
$receipt = @{source='profiles/native/lifesigns_status.cpp';sourceSha256=(Get-FileHash -LiteralPath $source).Hash.ToLowerInvariant();dll=$dll;sha256=(Get-FileHash -LiteralPath $dll).Hash.ToLowerInvariant();architecture='x64';runtime='static MSVC';utc=[DateTime]::UtcNow.ToString('o')}
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $output 'build.local.json') -Encoding UTF8
$receipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'local-data/profile-native-build/latest.local.json') -Encoding UTF8
Write-Output ('Built native reader; receipt: '+$output.Substring($root.Length+1)+'/build.local.json')
