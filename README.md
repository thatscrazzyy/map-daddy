# Map Daddy

Map Daddy is a projection mapping tool where a hosted web controller edits scenes and a Raspberry Pi receiver renders the projection fullscreen over HDMI.

```text
Hosted Web Controller
    -> WebSocket
Map Daddy Relay Server
    -> WebSocket
Raspberry Pi Receiver/Renderer
    -> HDMI
Projector
```

The relay only passes JSON. Media files are served from a public backend URL, tunnel, or storage provider and are downloaded/cached by the Pi receiver.

## Repository

- `frontend/`: React/Vite controller and mapping editor.
- `backend/`: FastAPI scene and media server.
- `relay/`: WebSocket relay for internet pairing codes.
- `renderer-pi/`: Python/Pygame/OpenCV Raspberry Pi receiver.
- `shared/`: Scene schema and example scene.
- `docs/`: Architecture, Pi, relay, and mapping model notes.

## Quick Start

```bash
make install
make backend
make frontend
make relay
make receiver-windowed
```

For separate terminals:

```bash
cd backend && make dev
cd frontend && make dev
cd relay && make dev
cd renderer-pi && make run-windowed
```

Open the frontend at `http://localhost:5173`, create or load a scene, assign media to a surface, and drag the quad corners.

## Hosted Controller Setup

Set these variables when hosting the frontend:

```bash
NEXT_PUBLIC_MAP_DADDY_RELAY_URL=wss://your-relay.example.com
NEXT_PUBLIC_MAP_DADDY_PUBLIC_BACKEND_URL=https://your-public-backend.example.com
```

Vite equivalents are also supported:

```bash
VITE_MAP_DADDY_RELAY_URL=wss://your-relay.example.com
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=https://your-public-backend.example.com
```

If a source URL starts with `/media/`, the frontend converts it to the public backend URL before sending it through the relay.

## Relay Setup

```bash
cd relay
make install
PORT=8080 make start
```

Deploy `relay/` to any Node.js host that supports WebSockets. The relay stores rooms in memory and does not store media.

## Pi Receiver Setup

On Raspberry Pi OS:

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip libsdl2-dev libsdl2-image-dev libsdl2-mixer-dev libsdl2-ttf-dev libgl1 libglib2.0-0
cd renderer-pi
make install
make run-windowed
```

Run fullscreen:

```bash
make run
```

Connect to a hosted relay:

```bash
make run-relay RELAY=wss://your-relay.example.com CODE=MD-123456
```

Install autostart from the repo root path:

```bash
cd renderer-pi
make autostart-install PROJECT_DIR=/home/pi/map-daddy
make autostart-enable
make logs
```

## Demo Flow

1. Start or deploy the backend and relay.
2. Start the Pi receiver and note the pairing screen.
3. Open the hosted controller.
4. Click **Connect Projector** and copy the `MD-######` code.
5. Enter that code on the Pi receiver.
6. Upload media, assign it to a surface, and drag the quad to match the projection target.

## Make Commands

- `make install`: install backend, frontend, relay, and receiver dependencies.
- `make install-pi`: same install path for Raspberry Pi setup.
- `make backend`, `make frontend`, `make relay`: run dev services.
- `make receiver`: run fullscreen receiver.
- `make receiver-windowed`: run receiver in a window.
- `make test`: compile Python and build/check available JS projects.
- `make clean`: clear receiver media cache.

## Mapping Model

Scenes use version `0.2.0` and split media from geometry:

- `sources`: image, video, or generated content loaded by URL.
- `surfaces`: quads or future polygons with source and destination points.
- `source_id`: the relationship between a surface and source.
- `mapper`: resolves sources, renders visible surfaces, and applies perspective transforms.

See [docs/mapping-model.md](docs/mapping-model.md).
