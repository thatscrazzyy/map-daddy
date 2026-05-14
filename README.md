# Map Daddy

Map Daddy is a projection mapping demo product with a hosted web controller and a downloadable receiver app for PCs and Raspberry Pi.

Public website placeholder:

```text
https://your-map-daddy-site.com
```

```text
Hosted Web Controller
    -> creates a protected session
Map Daddy Relay Server
    -> WebSocket JSON only
Map Daddy Receiver
    -> HDMI / projector
```

The relay never sends media files over WebSocket. Media URLs are public backend/storage URLs that the receiver downloads into its local cache.

## Repository

- `frontend/`: React/Vite controller and mapping editor.
- `backend/`: FastAPI scene/media API and optional session proxy.
- `relay/`: WebSocket relay with protected pairing sessions.
- `renderer-pi/`: Python/Pygame/OpenCV receiver.
- `shared/`: Scene schema and example scene.
- `docs/`: Architecture, setup, hosting, and release notes.

## Public Demo Flow

1. Download a receiver from GitHub Releases.
2. Open `https://your-map-daddy-site.com`.
3. Click **Start Projection Session**.
4. Enter the displayed pairing code and password in the receiver.
5. Edit the scene in the browser and project from the receiver.

## Downloadable Receiver Builds

Release artifacts are built with PyInstaller:

- `MapDaddy-Receiver-Windows-x64.exe`
- `MapDaddy-Receiver-Linux-x64`
- `MapDaddy-Receiver-RaspberryPi-arm64` when an ARM64/self-hosted runner is enabled

Run from source for development:

```bash
cd renderer-pi
python3 mapdaddy_receiver.py --relay wss://relay-url.com --code MD-123456 --session-secret generated-secret
python3 mapdaddy_receiver.py --server http://localhost:8000
python3 mapdaddy_receiver.py --windowed
```

## Quick Start for Developers

```bash
make install
make backend
make frontend
make relay
make receiver-windowed
```

Open the frontend at `http://localhost:5173`, click **Start Projection Session**, then enter the pairing code and password in the receiver.

## Hosted Controller Setup

Set these variables on Vercel, Netlify, Render, or your static host:

```bash
VITE_MAP_DADDY_API_URL=https://your-public-backend.example.com
VITE_MAP_DADDY_RELAY_URL=wss://relay.mapdaddy.com
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=https://your-public-backend.example.com
```

`NEXT_PUBLIC_*` equivalents are also supported:

```bash
NEXT_PUBLIC_MAP_DADDY_API_URL=https://your-public-backend.example.com
NEXT_PUBLIC_MAP_DADDY_RELAY_URL=wss://relay.mapdaddy.com
NEXT_PUBLIC_MAP_DADDY_PUBLIC_BACKEND_URL=https://your-public-backend.example.com
```

If no backend is reachable, the hosted controller still opens with a demo scene. Media upload and saving need the backend.

## Relay Setup

```bash
cd relay
make install
PUBLIC_RELAY_URL=ws://localhost:8080 PORT=8080 make start
```

Production relay environment:

```bash
PUBLIC_RELAY_URL=wss://relay.mapdaddy.com
SESSION_TTL_MS=7200000
PORT=8080
```

Sessions are created with `POST /sessions`. The response includes `relay_url`, `pairing_code`, `session_secret`, and `expires_at`. Both controller and receiver must join with the pairing code and `sessionSecret`.

## Receiver Config

Linux and Raspberry Pi config is stored at:

```text
~/.mapdaddy/config.json
```

Windows config is stored at:

```text
%APPDATA%\MapDaddy\config.json
```

Default config shape:

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

The receiver only saves `last_session_secret` when `auto_connect` is enabled.
On Windows, the default `media_cache_dir` is `%APPDATA%\MapDaddy\cache`.

## Release Process

Create a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

`.github/workflows/release.yml` builds the frontend, checks backend/relay code, builds Windows and Linux receiver artifacts, and uploads them to a GitHub Release.

Raspberry Pi ARM64 builds are native builds. Add a self-hosted Linux ARM64 runner with the `self-hosted`, `linux`, and `ARM64` labels, then set repository variable `BUILD_PI_ARM64=true`. Without that runner, the Pi job is skipped and no Pi artifact is published.

## Make Commands

- `make install`: install backend, frontend, relay, and receiver dependencies.
- `make backend`, `make frontend`, `make relay`: run dev services.
- `make receiver`, `make receiver-windowed`: run the receiver from source.
- `make build-receiver`: build the receiver executable for the current platform path.
- `make package`: build receiver and frontend assets.
- `make release-check`: run release-oriented checks and local receiver packaging.
- `make test`: compile Python and build/check available JS projects.
- `make clean`: clear receiver media cache.

See [docs/public-demo-release.md](docs/public-demo-release.md), [docs/relay-setup.md](docs/relay-setup.md), and [docs/pi-setup.md](docs/pi-setup.md).
