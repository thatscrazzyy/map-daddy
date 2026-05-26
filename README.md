# Map Daddy

Map Daddy is a projection mapping demo product with a hosted web controller and a downloadable receiver app for PCs and Raspberry Pi. Its editor model borrows mature projection-mapping concepts from MapMap, but keeps Map Daddy's web/relay/receiver architecture.

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

## Mapping Model

Scene version `0.3.0` separates:

```text
Source/Paint -> Mapping/Layer -> Input Shape + Output Shape
```

Old `0.2.0` surface scenes are migrated automatically. See [docs/mapping-model.md](docs/mapping-model.md) and [docs/editor-guide.md](docs/editor-guide.md).

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
- `MapDaddy-Receiver-Linux-arm64`
- `MapDaddy-Receiver-RaspberryPi-arm64`

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

## Online Deployment

Recommended low-setup public deployment:

- Frontend: GitHub Pages.
- Backend/media API: Cloudflare Worker + R2 + KV.
- Relay: Cloudflare Worker + Durable Object WebSockets.

Deployment files are included:

- `cloudflare/worker/`
- `.github/workflows/deploy-frontend-pages.yml`
- `frontend/vercel.json`
- `backend/Dockerfile`
- `relay/Dockerfile`
- `render.yaml`

See [docs/deployment-guide.md](docs/deployment-guide.md).

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

`.github/workflows/release.yml` builds the frontend, checks backend/relay code, builds Windows, Linux x64, native Linux ARM64, and Raspberry Pi ARM64 receiver artifacts, and uploads them to a GitHub Release.

Linux ARM64 uses GitHub's hosted `ubuntu-24.04-arm` runner. Raspberry Pi ARM64 is a required Pi-specific build and must run on Raspberry Pi hardware through a self-hosted runner. Register the Pi runner with these labels:

```text
self-hosted
linux
ARM64
raspberry-pi
```

Without that runner, tagged releases will wait for the Pi job and will not publish. This is intentional so the `RaspberryPi` artifact is not a generic ARM build mislabeled as Pi-specific.

## Make Commands

- `make install`: install backend, frontend, relay, and receiver dependencies.
- `make backend`, `make frontend`, `make relay`: run dev services.
- `make receiver`, `make receiver-windowed`: run the receiver from source.
- `make build-receiver`: build the receiver executable for the current platform path.
- `make package`: build receiver and frontend assets.
- `make release-check`: run release-oriented checks and local receiver packaging.
- `make test`: compile Python and build/check available JS projects.
- `make clean`: clear receiver media cache.

See [docs/public-demo-release.md](docs/public-demo-release.md), [docs/relay-setup.md](docs/relay-setup.md), [docs/pi-setup.md](docs/pi-setup.md), [docs/release-guide.md](docs/release-guide.md), and [docs/deployment-guide.md](docs/deployment-guide.md).
