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

IS_RASPBERRY_PI="false"
if [[ -r /proc/device-tree/model ]] && tr -d '\0' < /proc/device-tree/model | grep -qi "raspberry pi"; then
  IS_RASPBERRY_PI="true"
fi

if [[ "$IS_RASPBERRY_PI" != "true" && "${MAP_DADDY_ALLOW_NON_PI_ARM:-}" != "1" ]]; then
  echo "This is the Raspberry Pi-specific build script and must run on Raspberry Pi hardware." >&2
  echo "Detected architecture: ${ARCH}" >&2
  echo "If you intentionally need a generic Linux ARM64 build, use scripts/build_linux.sh MapDaddy-Receiver-Linux-arm64 instead." >&2
  exit 1
fi

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
