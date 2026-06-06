# Map Daddy

Current public version: **v0.2.0**. The canonical release number is tracked in [`VERSION`](VERSION).

Map Daddy is an open-source, browser-first projection mapping app for people who want projection mapping without paying for expensive production software. It is designed for hobbyists, makers, students, small creative teams, and anyone who wants to get media mapped onto a wall, poster, screen, or panel quickly.

The v0.2.0 goal is simple: open the app, add media, map a surface, open a projector tab, and have something running in under five minutes. The first success path works fully in one browser without a backend, relay, account, cloud service, or Raspberry Pi.

## What's New in v0.2.0

- Local-first browser workflow: the frontend can run by itself.
- IndexedDB image persistence for local uploads and sample images.
- Same-browser editor-to-projector sync through browser-native messaging.
- One-click sample media for first-time users.
- First-run checklist for blank projects.
- Surface tools for center, fit, reset, duplicate, ordering, and snap-to-grid.
- Source crop controls for mapped media.
- Video playback controls and a session-only warning for local video uploads.
- Public version labels in the app and repository.

## Features

- Browser dashboard for creating and opening projects.
- Browser editor at `/editor/:projectId`.
- Browser projector output at `/projector/:projectId`.
- Fully local project storage through `localStorage`.
- Durable local image storage through IndexedDB.
- Same-browser live projector updates without running the relay.
- Optional WebSocket relay for multi-device sync.
- Image uploads, sample media, video uploads, and media selection.
- Quad surface creation, corner dragging, whole-surface dragging, and keyboard nudging.
- Surface alignment tools: center, fit, reset, duplicate, bring forward/backward, and snap-to-grid.
- Source crop controls with full, half, and quarter crop presets.
- Canvas renderer with lightweight quad warping.
- Cloudflare Worker support for hosted project API, media storage, and realtime rooms.
- Legacy Python receiver code remains available for Raspberry Pi and desktop receiver experiments.

## Screenshots

Dashboard project management:

![Map Daddy dashboard project list](docs/assets/screenshots/dashboard-projects.png)

Editor surface mapping:

![Map Daddy editor with image surface mapping](docs/assets/screenshots/editor-surface-mapping.png)

Browser projector output:

![Map Daddy browser projector output](docs/assets/screenshots/projector-output.png)

## Architecture

```text
Browser Controller / Editor
  - edits project state
  - stores local projects in localStorage
  - stores local images in IndexedDB
  - uploads/selects/crops media
  - drags surface corners or whole surfaces
  - saves project state
  - sends live updates locally or through relay

Browser Projector
  - render-only fullscreen output
  - loads latest saved local project on open
  - receives same-browser local updates

Optional FastAPI Backend
  - stores projects as JSON
  - serves uploaded media
  - can proxy relay session creation for legacy receiver flows

Optional WebSocket Relay
  - hosts project rooms
  - broadcasts editor updates to projector clients
  - keeps the latest in-memory project state for reconnects
```

The browser-only path uses `localStorage`, IndexedDB, `BroadcastChannel`, and `storage` events. The relay sends JSON only and is only needed when you want separate devices to sync over the network.

## Repository Layout

```text
frontend/          Vite + React browser dashboard, editor, and projector
backend/           FastAPI project/media API
relay/             Node WebSocket relay for live project rooms
cloudflare/worker/ Cloudflare Worker implementation for hosted API/realtime
renderer-pi/       Legacy Python receiver for Raspberry Pi/Desktop
renderer/          Older renderer prototype
shared/            Scene schema and examples
docs/              Architecture, setup, deployment, and release notes
```

## Quick Start

For the local-first browser workflow, only the frontend is required:

```powershell
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173/dashboard
```

Create a project, click **Sample** or upload an image, adjust the surface, then open the projector link in another tab or projector-connected browser window.

GitHub Pages project deployments live under the repository path:

```text
https://thatscrazzyy.github.io/map-daddy/
```

Use `/map-daddy/editor/:projectId` and `/map-daddy/projector/:projectId` on GitHub Pages. The app generates those links automatically when it is built by the Pages workflow.

Optional backend and relay services are still available for hosted or multi-device work:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python main.py
```

```powershell
cd relay
npm install
npm run dev
```

## Primary Product Flow

1. Start the frontend.
2. Open the dashboard at `http://localhost:5173/dashboard`.
3. Create a project.
4. Click **Sample** or upload an image.
5. Drag the surface corners to fit a wall, poster, screen, or panel.
6. Click **Projector** or copy the projector link.
7. Open `/projector/:projectId` in another tab or window.
8. Click **Fullscreen** on the projector page.
9. Keep editing from the browser editor and watch the projector update locally.

## Local Testing Checklist

- Start the frontend.
- Open the editor in one browser tab.
- Open the projector page in another browser tab.
- Click **Sample** and verify a surface is created automatically.
- Refresh the editor and verify the sample image persists.
- Upload an image and verify it persists after refresh.
- Drag a surface corner and verify the projector updates live.
- Drag the whole surface and verify the projector updates live.
- Refresh the projector page and verify the latest saved project loads.
- Upload a video and verify it is marked session-only in local mode.

## Local Environment

The browser-only path does not require environment variables.

For hosted or multi-device development, create `frontend/.env.local`:

```env
VITE_MAP_DADDY_API_URL=http://localhost:8000
VITE_MAP_DADDY_RELAY_URL=ws://localhost:8080
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=http://localhost:8000
```

Do not commit real `.env` files. They are ignored by Git.

If port `8080` is already in use, run the relay on another port:

```powershell
$env:PORT=8081
npm run dev
```

Then point the frontend to it:

```powershell
$env:VITE_MAP_DADDY_RELAY_URL="ws://localhost:8081"
npm run dev
```

If these values are omitted, the frontend stays in local-first mode and avoids trying to connect to localhost services.

## Testing

Frontend:

```powershell
cd frontend
npm run build
npx playwright test
```

Relay:

```powershell
cd relay
npm test
```

Backend:

```powershell
cd backend
python -m pytest
```

Cloudflare Worker syntax check:

```powershell
cd cloudflare/worker
node --check src/index.js
```

## Project State

The local-first project model uses this central shape. Local images are saved in IndexedDB and referenced from project JSON with `local://` URLs; hosted media can still use `/media/...` or absolute URLs.

```json
{
  "id": "project_123",
  "name": "Gallery Wall",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#000000"
  },
  "media": [
    {
      "id": "local_media_123",
      "type": "image",
      "url": "local://local_media_123",
      "name": "example.png"
    }
  ],
  "surfaces": [
    {
      "id": "surface_123",
      "name": "Surface 1",
      "mediaId": "media_123",
      "visible": true,
      "opacity": 1,
      "blendMode": "source-over",
      "sourceRect": {
        "x": 0,
        "y": 0,
        "width": 1024,
        "height": 768
      },
      "destinationQuad": [
        { "x": 100, "y": 100 },
        { "x": 900, "y": 100 },
        { "x": 900, "y": 700 },
        { "x": 100, "y": 700 }
      ]
    }
  ],
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

## Deployment

There are two supported paths:

- Local/dev stack: Vite frontend, FastAPI backend, Node relay.
- Hosted stack: static frontend plus Cloudflare Worker/KV/R2/Durable Objects.

The checked-in `cloudflare/worker/wrangler.toml` intentionally contains placeholder KV and R2 identifiers. Put real values in your local deployment config or CI secrets, not in the public repository.

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/deployment-guide.md](docs/deployment-guide.md)
- [docs/relay-setup.md](docs/relay-setup.md)
- [docs/pi-setup.md](docs/pi-setup.md)

## Optional Pro Receiver

The default Map Daddy flow is browser editor to browser projector. The Python/Raspberry Pi receiver remains in the repo as an optional Pro Receiver for installations that need a dedicated native output app.

Run from source:

```bash
cd renderer-pi
python3 mapdaddy_receiver.py --relay wss://relay-url.com --code MD-123456 --session-secret generated-secret
python3 mapdaddy_receiver.py --server http://localhost:8000
python3 mapdaddy_receiver.py --windowed
```

Release artifacts can still be built with PyInstaller:

- `MapDaddy-Receiver-Windows-x64.exe`
- `MapDaddy-Receiver-Linux-x64`
- `MapDaddy-Receiver-Linux-arm64`
- `MapDaddy-Receiver-RaspberryPi-arm64`

## Security And Privacy

- `.env`, `.env.local`, backend media, backend project data, logs, tunnel config, and local build outputs are ignored.
- WebSocket messages should contain project JSON only, not private files or secrets.
- Uploaded media is served by URL. Treat media URLs as public unless your deployment adds authentication.
- Do not commit Cloudflare account IDs, KV namespace IDs, R2 bucket names, API tokens, tunnel credentials, or private keys.

Report security issues privately. See [SECURITY.md](SECURITY.md).

## Contributing

Contributions are welcome. Start with focused issues or pull requests that improve:

- Browser editor ergonomics.
- Projector rendering correctness.
- Realtime reconnect behavior.
- Storage adapters.
- Documentation and test coverage.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Built With AI Agents

Map Daddy was developed using a multi-agent workflow:

- Product Manager Agent
  - Requirements
  - Feature prioritization
  - Ticket generation

- Architect Agent
  - System design
  - Refactoring plans
  - Technical specifications

- Engineer Agent
  - Implementation
  - Bug fixes
  - Testing support

- QA Agent
  - Test plans
  - Edge case validation
  - UI verification

## License

Map Daddy is released under the MIT License. See [LICENSE](LICENSE).
