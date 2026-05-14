# Raspberry Pi Setup

## Downloaded Receiver

For the public demo, download `MapDaddy-Receiver-RaspberryPi-arm64` from GitHub Releases, copy it to the Pi, mark it executable, and run it:

```bash
chmod +x MapDaddy-Receiver-RaspberryPi-arm64
./MapDaddy-Receiver-RaspberryPi-arm64
```

Open the hosted controller, click **Start Projection Session**, then enter the displayed pairing code and password in the receiver.

## Source Dependencies

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libgl1 libglib2.0-0
```

## Receiver From Source

```bash
cd renderer-pi
make install
make run-windowed
```

Run fullscreen:

```bash
make run
```

Connect to a relay:

```bash
make run-relay RELAY=wss://relay.mapdaddy.com CODE=MD-123456 SECRET=generated-secret
```

Use local backend polling:

```bash
make run-local SERVER=http://192.168.1.25:8000
```

## Build Pi Executable

Run on Raspberry Pi OS or a Linux ARM64 machine:

```bash
cd renderer-pi
bash scripts/build_pi.sh
```

GitHub-hosted x64 runners do not produce a reliable Raspberry Pi PyInstaller binary. For release automation, add a self-hosted Linux ARM64 GitHub Actions runner and set repository variable `BUILD_PI_ARM64=true`.

## Autostart

The service file is a template. Install it with your repo path:

```bash
cd renderer-pi
make autostart-install PROJECT_DIR=/home/pi/map-daddy
make autostart-enable
make logs
```

Disable autostart:

```bash
make autostart-disable
```

## HDMI Notes

Set the Pi desktop resolution to match the projector when possible. If fullscreen opens on the wrong display, confirm the active X session and `DISPLAY=:0`.

## Troubleshooting

- Black screen: check that the scene has sources with reachable public URLs.
- Media fails: run `make clean-cache` and restart the receiver.
- Relay does not connect: verify the relay URL, pairing code, password, and relay health endpoint.
- Session rejected: start a new session; sessions expire after about 2 hours by default.
- Autostart fails: run `journalctl -u mapdaddy-receiver.service -f`.
