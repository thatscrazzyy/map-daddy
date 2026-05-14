# Raspberry Pi Setup

## Dependencies

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libgl1 libglib2.0-0
```

## Receiver Install

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
make run-relay RELAY=wss://your-relay.example.com CODE=MD-123456
```

Use local backend polling:

```bash
make run-local SERVER=http://192.168.1.25:8000
```

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
- Relay does not connect: verify `wss://` URL, pairing code, and relay health endpoint.
- Autostart fails: run `journalctl -u mapdaddy-receiver.service -f`.
