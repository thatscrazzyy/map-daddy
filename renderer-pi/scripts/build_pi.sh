#!/usr/bin/env bash
set -euo pipefail

ARCH="$(uname -m)"
case "$ARCH" in
  aarch64|arm64)
    ARTIFACT_NAME="${1:-MapDaddy-Receiver-RaspberryPi-arm64}"
    ;;
  armv7l|armhf)
    ARTIFACT_NAME="${1:-MapDaddy-Receiver-RaspberryPi-armv7}"
    ;;
  *)
    echo "This script must run on Raspberry Pi OS or a Linux ARM runner. Detected: ${ARCH}" >&2
    exit 1
    ;;
esac

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
