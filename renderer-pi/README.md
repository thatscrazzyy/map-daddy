# Map Daddy Receiver

The projection receiver for Map Daddy. It connects to a relay session with a pairing code and password, downloads public media URLs into a local cache, and renders mapped scenes fullscreen with Pygame and OpenCV.

## Download

Download one of these from GitHub Releases:

- `MapDaddy-Receiver-Windows-x64.exe`
- `MapDaddy-Receiver-Linux-x64`
- `MapDaddy-Receiver-RaspberryPi-arm64`

Run the executable, enter the pairing code and password shown by the hosted controller, then press `ENTER`.

## Install From Source

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libgl1 libglib2.0-0
make install
```

## Run From Source

```bash
make run
make run-windowed
make run-relay RELAY=wss://relay-url.com CODE=MD-123456 SECRET=generated-secret
make run-local SERVER=http://192.168.1.25:8000
```

Equivalent direct commands:

```bash
python3 mapdaddy_receiver.py
python3 mapdaddy_receiver.py --relay wss://relay-url.com --code MD-123456 --session-secret generated-secret
python3 mapdaddy_receiver.py --server http://192.168.1.25:8000
python3 mapdaddy_receiver.py --windowed --width 1280 --height 720
```

## Build Executables

Windows:

```powershell
.\scripts\build_windows.ps1
```

Linux desktop:

```bash
bash scripts/build_linux.sh
```

Raspberry Pi:

```bash
bash scripts/build_pi.sh
```

Raspberry Pi builds should run on Raspberry Pi OS or a Linux ARM64 runner. PyInstaller does not reliably cross-compile this app from x64 GitHub-hosted runners.

## Pairing UI

The receiver pairing screen includes:

- Pairing code input
- Password/session key input
- Connection status
- Settings access for advanced relay URL changes

Settings include relay URL, auto-connect, fullscreen, overlay, resolution, and clear cache.

## Keyboard Shortcuts

- `ESC`: quit
- `F11`: toggle fullscreen from pairing/settings
- `F`: toggle fullscreen outside text-entry screens
- `H`: show/hide status overlay
- `F2`: settings screen from pairing
- `S`: settings screen outside pairing
- `F1`: return to pairing from settings
- `C`: connection screen
- `R`: clear media cache
- `ENTER`: connect from pairing screen
- `TAB`: switch pairing input field

## Config

Linux and Raspberry Pi:

```text
~/.mapdaddy/config.json
```

Windows:

```text
%APPDATA%\MapDaddy\config.json
```

```json
{
  "relay_url": "wss://relay.mapdaddy.com",
  "last_pairing_code": "",
  "last_session_secret": "",
  "width": 1920,
  "height": 1080,
  "fullscreen": true,
  "auto_connect": false,
  "show_status_overlay": true,
  "media_cache_dir": "~/.mapdaddy/cache"
}
```

`last_session_secret` is only persisted when `auto_connect` is enabled.
On Windows, the default `media_cache_dir` is `%APPDATA%\MapDaddy\cache`.

## Autostart

Install the systemd service with the actual project path:

```bash
make autostart-install PROJECT_DIR=/home/pi/map-daddy
make autostart-enable
make logs
```

Disable it:

```bash
make autostart-disable
```
