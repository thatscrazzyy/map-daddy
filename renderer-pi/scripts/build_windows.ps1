param(
  [string]$ArtifactName = "MapDaddy-Receiver-Windows-x64.exe"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $Root

python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
python -m PyInstaller --clean --noconfirm build/mapdaddy_receiver.spec

$Source = Join-Path $Root "dist/MapDaddy-Receiver.exe"
$TargetDir = Join-Path $Root "dist/release"
$Target = Join-Path $TargetDir $ArtifactName
New-Item -ItemType Directory -Force $TargetDir | Out-Null
Copy-Item $Source $Target -Force
Write-Host "Built $Target"
