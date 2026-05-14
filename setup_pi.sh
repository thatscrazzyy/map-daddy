#!/bin/bash
set -euo pipefail

echo "Setting up Map Daddy on Raspberry Pi..."
cd "$(dirname "$0")"
PROJECT_ROOT="$(pwd)"

sudo apt update
sudo apt install -y \
  python3-pip \
  python3-venv \
  nodejs \
  npm \
  libsdl2-dev \
  libsdl2-image-dev \
  libsdl2-mixer-dev \
  libsdl2-ttf-dev \
  libgl1 \
  libglib2.0-0

make install-pi

echo
echo "Install complete."
echo "Run the receiver:"
echo "  cd $PROJECT_ROOT/renderer-pi && make run"
echo
echo "Install receiver autostart:"
echo "  cd $PROJECT_ROOT/renderer-pi && make autostart-install PROJECT_DIR=$PROJECT_ROOT && make autostart-enable"
