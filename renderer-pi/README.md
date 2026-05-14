# Map Daddy Receiver

The Raspberry Pi projection receiver for Map Daddy. It connects to the relay with a pairing code or polls a local backend, downloads public media URLs into a local cache, and renders mapped scenes fullscreen with Pygame and OpenCV.

## Install

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libgl1 libglib2.0-0
make install
```

## Run

```bash
make run
make run-windowed
make run-relay RELAY=wss://your-relay.example.com CODE=MD-123456
make run-local SERVER=http://192.168.1.25:8000
```

Equivalent direct commands:

```bash
python3 mapdaddy_receiver.py
python3 mapdaddy_receiver.py --relay wss://relay-url.com --code MD-123456
python3 mapdaddy_receiver.py --server http://192.168.1.25:8000
python3 mapdaddy_receiver.py --windowed --width 1280 --height 720
```

## Keyboard Shortcuts

- `ESC`: quit
- `F`: toggle fullscreen
- `H`: show/hide status overlay
- `S`: settings screen
- `C`: connection screen
- `R`: clear media cache
- `ENTER`: connect from pairing screen

## Config

Config is stored at `~/.mapdaddy/config.json`.

```json
{
  "relay_url": "wss://your-relay-server.com",
  "last_pairing_code": "MD-123456",
  "width": 1920,
  "height": 1080,
  "fullscreen": true,
  "auto_connect": false,
  "show_status_overlay": true,
  "media_cache_dir": "~/.mapdaddy/cache"
}
```

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
