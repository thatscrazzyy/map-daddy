# Map Daddy Relay Server

A lightweight HTTP/WebSocket relay for Map Daddy.

It supports two protocols:

- Project rooms for the browser editor and browser projector workflow.
- Protected pairing sessions for the legacy Python receiver workflow.

The relay passes JSON only. It does not store, upload, or proxy media files.

## Setup

```bash
make install
PUBLIC_RELAY_URL=ws://localhost:8080 make dev
```

## Production

```bash
PUBLIC_RELAY_URL=wss://relay.mapdaddy.com PORT=8080 make start
```

## Environment Variables

- `PORT`: HTTP/WebSocket port, default `8080`.
- `PUBLIC_RELAY_URL`: public WebSocket URL returned by `POST /sessions`.
- `SESSION_TTL_MS`: session lifetime, default 2 hours.
- `SESSION_CLEANUP_INTERVAL_MS`: cleanup interval, default 5 minutes.

## API

Health:

```bash
curl http://localhost:8080/health
```

## Browser Project-Room Protocol

Editor join:

```json
{ "type": "project:join", "role": "editor", "projectId": "project_123" }
```

Projector join:

```json
{ "type": "project:join", "role": "projector", "projectId": "project_123" }
```

Project update from editor:

```json
{ "type": "project:update", "projectId": "project_123", "project": {} }
```

Presence update from relay:

```json
{ "type": "project:presence", "projectId": "project_123", "editorCount": 1, "projectorCount": 2 }
```

The relay broadcasts each editor update to every projector joined to the same project room. A projector receives the latest in-memory project update when it reconnects.

## Legacy Pairing Session API

Create a session:

```bash
curl -X POST http://localhost:8080/sessions
```

Create a session with your own receiver password:

```bash
curl -X POST http://localhost:8080/sessions \
  -H "Content-Type: application/json" \
  -d '{"session_secret":"my-custom-password"}'
```

Response:

```json
{
  "relay_url": "ws://localhost:8080",
  "pairing_code": "MD-123456",
  "session_secret": "generated-secret",
  "expires_at": "2026-05-14T12:00:00.000Z"
}
```

## Legacy Pairing Session Protocol

Renderer join:

```json
{ "type": "join", "role": "renderer", "code": "MD-123456", "sessionSecret": "generated-secret" }
```

Controller join:

```json
{ "type": "join", "role": "controller", "code": "MD-123456", "sessionSecret": "generated-secret" }
```

Scene update:

```json
{ "type": "scene:update", "code": "MD-123456", "scene": {} }
```

The relay rejects missing code, missing secret, wrong secret, expired sessions, and invalid roles. Raw secrets are not logged.
