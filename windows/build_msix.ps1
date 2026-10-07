# Packs dist\Keybo (the PyInstaller folder) into the Microsoft Store package dist\Keybo-<version>-windows-x64.msix.
# Run on Windows after windows\build.bat (CI: .github/workflows/windows-app.yml). Needs the Windows SDK (makeappx.exe).
#
# The three identity values come from Partner Center (Product management -> Product identity). Without them the package
# is built with placeholders: good for testing the build, but the Store rejects it.
#   -IdentityName          "Package/Identity/Name"        e.g. 12345Publisher.Keybo
#   -Publisher             "Package/Identity/Publisher"   e.g. CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
#   -PublisherDisplayName  "Package/Properties/PublisherDisplayName"
# The package is NOT signed: the Store signs it after you upload it.
param(
  [string]$IdentityName = $env:MSIX_IDENTITY_NAME,
  [string]$Publisher = $env:MSIX_PUBLISHER,
  [string]$PublisherDisplayName = $env:MSIX_PUBLISHER_DISPLAY_NAME,
  [string]$Exe = "dist\Keybo\Keybo.exe"
)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$placeholder = -not ($IdentityName -and $Publisher -and $PublisherDisplayName)
if ($placeholder) {
  Write-Warning "No Partner Center identity given: building a TEST package that the Store will reject."
  $IdentityName = "Keybo.Test"; $Publisher = "CN=Test"; $PublisherDisplayName = "Keybo"
}
if (-not (Test-Path $Exe)) { throw "$Exe not found. Build the app first (windows\build.bat)." }

# Store versions are a.b.c.d and the Store reserves d (the last number) for itself: it must be 0.
$version = (Get-Content VERSION -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw "VERSION '$version' is not major.minor.patch" }
$msixVersion = "$version.0"

$makeappx = (Get-Command makeappx.exe -ErrorAction SilentlyContinue).Source
if (-not $makeappx) {
  $makeappx = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\makeappx.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.FullName -replace '.*\\bin\\([\d.]+)\\x64\\.*', '$1') } -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $makeappx) { throw "makeappx.exe not found. Install the Windows 10/11 SDK." }

$layout = "build\msix-layout"
if (Test-Path $layout) { Remove-Item $layout -Recurse -Force }
New-Item -ItemType Directory $layout | Out-Null
Copy-Item "dist\Keybo\*" $layout -Recurse
Copy-Item "windows\msix\Assets" "$layout\Assets" -Recurse

$xml = Get-Content "windows\msix\AppxManifest.xml.in" -Raw -Encoding UTF8
$xml = $xml.Replace("@IDENTITY_NAME@", [Security.SecurityElement]::Escape($IdentityName)).
  Replace("@PUBLISHER@", [Security.SecurityElement]::Escape($Publisher)).
  Replace("@PUBLISHER_DISPLAY_NAME@", [Security.SecurityElement]::Escape($PublisherDisplayName)).
  Replace("@VERSION@", $msixVersion)
[IO.File]::WriteAllText((Join-Path (Resolve-Path $layout) "AppxManifest.xml"), $xml, (New-Object Text.UTF8Encoding $false))

$out = "dist\Keybo-$version-windows-x64.msix"
if (Test-Path $out) { Remove-Item $out }
& $makeappx pack /d $layout /p $out /o
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }
Write-Host "Built $out" $(if ($placeholder) { "(test identity, not for the Store)" } else { "" })
