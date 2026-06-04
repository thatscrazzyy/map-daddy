# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Map Daddy** is a browser-first projection mapping app. Users create projects in a dashboard, edit surface mappings in an editor, and display mapped output on projectors — all synced live over WebSocket.

Three services run together: a **React frontend** (Vite), a **FastAPI backend** (projects/media storage), and a **Node.js relay** (WebSocket room manager). A Cloudflare Workers version exists as an alternative hosted backend.

## Development Commands

Start all three services (each in its own terminal, or use Make):

```powershell
# Backend (Python)
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py                  # runs on :8000

# Relay (Node)
cd relay
npm install
npm run dev                     # runs on :8080

# Frontend (Vite + React)
cd frontend
npm install
npm run dev                     # runs on :5173
```

Or with Make from the project root:
```bash
make backend   # terminal 1
make relay     # terminal 2
make frontend  # terminal 3
```

Access the app at `http://localhost:5173/dashboard`.

## Testing

```powershell
# Frontend E2E (Playwright)
cd frontend
npm run build
npx playwright test
npx playwright test --grep "test name"   # single test

# Relay unit tests (Jest)
cd relay
npm test

# Backend unit tests (pytest)
cd backend
python -m pytest
python -m pytest test_main.py::test_name   # single test
```

## Environment Variables

```env
# frontend/.env.local
VITE_MAP_DADDY_API_URL=http://localhost:8000
VITE_MAP_DADDY_RELAY_URL=ws://localhost:8080
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=http://localhost:8000

# backend/.env
PORT=8000
CORS_ORIGINS=*
PUBLIC_RELAY_URL=ws://localhost:8080
MAP_DADDY_RELAY_SESSION_URL=http://localhost:8080/sessions
MAP_DADDY_MEDIA_DIR=media
MAP_DADDY_PROJECTS_DIR=projects
```

## Architecture

```
Browser (localhost:5173)
  /dashboard          → project list & creation
  /editor/:id         → editing UI (sends updates)
  /projector/:id      → render-only fullscreen view (receives updates)
         │
         │ HTTP REST
         ▼
FastAPI Backend (:8000)
  - Project CRUD → backend/projects/*.project.json
  - Media upload/serve → backend/media/
  - Creates relay sessions
         │
         │ WebSocket upgrade (via relay URL in project)
         ▼
Node.js Relay (:8080)
  - Maintains per-project rooms (editors + projectors)
  - Broadcasts project:update events from editors to projectors
  - Pairing codes (MD-XXXXXX) for browser→projector pairing
  - Session TTL: 2 hours
```

**Live sync flow:** Editor mutates project → POST to backend → backend stores JSON → relay broadcasts `project:update` → all projector clients for that room re-render.

## Key Source Locations

| Concern | Location |
|---|---|
| Project/surface types | `frontend/src/lib/projects/types.ts` |
| Storage abstraction | `frontend/src/lib/projects/projectRepository.ts` |
| WebSocket client | `frontend/src/lib/realtime/realtimeClient.ts` |
| Canvas rendering engine | `frontend/src/lib/rendering/canvasRenderer.ts` |
| Perspective quad warp | `frontend/src/lib/rendering/quadWarp.ts` |
| FastAPI routes | `backend/main.py` |
| WebSocket relay rooms | `relay/server.js` |
| Cloudflare hosted backend | `cloudflare/worker/` |

## Data Model

A **project** is a JSON document with:
- `canvas` — width/height/backgroundColor
- `media[]` — uploaded files referenced by URL
- `surfaces[]` — each surface maps a `sourceRect` from a media item onto a `destinationQuad` (4 corner points) on the canvas

Surfaces support `opacity`, `blendMode`, and `visible`. The quad warp in `quadWarp.ts` handles perspective transforms for non-rectangular projection targets.

## Code Conventions

- Keep projector page (`/projector/:id`) render-only — no editor state, no mutations
- Project storage is accessed through `projectRepository.ts` — don't bypass the abstraction
- Throttle noisy editor updates before sending over WebSocket
- Relay sessions are stateless from the backend's perspective; the relay manages room membership independently
- The Cloudflare worker mirrors the FastAPI API surface — keep them in sync when changing endpoints
