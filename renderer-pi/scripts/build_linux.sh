#!/usr/bin/env bash
set -euo pipefail

ARTIFACT_NAME="${1:-MapDaddy-Receiver-Linux-x64}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f build/mapdaddy_receiver.spec ]]; then
  echo "Missing build/mapdaddy_receiver.spec. Make sure renderer-pi/build/mapdaddy_receiver.spec is committed." >&2
  exit 1
fi

python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt pyinstaller
python3 -m PyInstaller --clean --noconfirm build/mapdaddy_receiver.spec

mkdir -p dist/release
cp dist/MapDaddy-Receiver "dist/release/${ARTIFACT_NAME}"
chmod +x "dist/release/${ARTIFACT_NAME}"
echo "Built dist/release/${ARTIFACT_NAME}"
