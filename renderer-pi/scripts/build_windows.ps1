param(
  [string]$ArtifactName = "MapDaddy-Receiver-Windows-x64.exe"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

$Spec = Join-Path $Root "build/mapdaddy_receiver.spec"
if (-not (Test-Path $Spec)) {
  throw "Missing build/mapdaddy_receiver.spec. Make sure renderer-pi/build/mapdaddy_receiver.spec is committed."
}

python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --clean --noconfirm $Spec

$Source = Join-Path $Root "dist/MapDaddy-Receiver.exe"
$TargetDir = Join-Path $Root "dist/release"
$Target = Join-Path $TargetDir $ArtifactName
New-Item -ItemType Directory -Force $TargetDir | Out-Null
Copy-Item $Source $Target -Force
Write-Host "Built $Target"
