# Architecture

Map Daddy is now centered on a browser controller plus browser projector workflow, while keeping the older Python receiver code available for Raspberry Pi and desktop receiver experiments.

## Primary Web-First Flow

```text
Browser Controller / Editor
        |
        | HTTP project/media API
        v
FastAPI Backend or Cloudflare Worker

Browser Controller / Editor
        |
        | WebSocket project:update
        v
Node Relay or Cloudflare Durable Object
        |
        | WebSocket project:update
        v
Browser Projector(s)
```

The editor owns project mutations. Projector clients are render-only and can reconnect to the latest saved project state.

## Frontend Routes

- `/dashboard`: project list and project creation.
- `/editor/:projectId`: controller/editor UI.
- `/projector/:projectId`: fullscreen render-only projector output.

The Vite app implements these as SPA routes in `frontend/src/app`.

## Project State

The web MVP uses a central `ProjectState` object:

```json
{
  "id": "project_123",
  "name": "Gallery Wall",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "backgroundColor": "#000000"
  },
  "media": [],
  "surfaces": [],
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

Each surface stores a media assignment, source crop rectangle, opacity/blend settings, and a four-point destination quad.

## Storage

The frontend talks to `src/lib/projects/projectRepository.ts`.

Current implementations:

- FastAPI backend stores projects in `backend/projects/*.project.json`.
- Frontend falls back to localStorage if the API is unavailable.
- Cloudflare Worker stores hosted projects in KV.

This keeps the UI independent from the eventual database or hosted storage provider.

## Realtime

The frontend talks to `src/lib/realtime/realtimeClient.ts`.

Project-room protocol:

```json
{ "type": "project:join", "role": "editor", "projectId": "project_123" }
```

```json
{ "type": "project:join", "role": "projector", "projectId": "project_123" }
```

```json
{ "type": "project:update", "projectId": "project_123", "project": {} }
```

The relay:

- accepts one or more editors and projectors per project room;
- broadcasts editor updates to every projector in the same project;
- reports projector presence back to editors;
- keeps the latest in-memory project state for projector reconnects.

Projectors also load the latest saved project from storage on first open, so a relay restart does not leave them blank.

## Rendering

Rendering is in `frontend/src/lib/rendering`.

The MVP uses a 2D canvas renderer. A quad is split into two clipped affine triangles. This is stable and lightweight, but it is not full perspective-correct WebGL warping. A future WebGL renderer can replace the canvas renderer behind the same project state model.

Editor preview and projector output both use the same renderer component.

## Media Handling

Media is not sent over WebSocket. Project JSON stores media URLs. Browser clients fetch those URLs directly.

Local FastAPI media uploads are served from `/media/...`. Cloudflare deployments can serve media from R2 through the Worker.

Treat media URLs as public unless your deployment adds authentication.

## Legacy Receiver Flow

The older pairing-session relay flow still exists for the Python receiver:

```text
Hosted Web Controller -> Pairing Session Relay -> Python Receiver -> HDMI/Projector
```

That protocol uses:

```json
{ "type": "join", "role": "controller", "code": "MD-123456", "sessionSecret": "generated-secret" }
```

and `scene:update` messages using the older scene model.

The Python receiver can also poll a local backend:

```bash
python3 mapdaddy_receiver.py --server http://192.168.1.25:8000
```

Relative `/media/...` URLs are resolved against the local server URL in that mode.
