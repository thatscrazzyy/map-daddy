# Relay Setup

The relay is a small Node.js HTTP/WebSocket server. Controllers and receivers connect through explicit sessions instead of manually created rooms.

## Local

```bash
cd relay
make install
PUBLIC_RELAY_URL=ws://localhost:8080 PORT=8080 make dev
```

Health check:

```bash
curl http://localhost:8080/health
```

Create a session:

```bash
curl -X POST http://localhost:8080/sessions
```

## Hosted

Deploy the `relay/` directory to a Node.js host such as Render, Railway, Fly.io, or a VPS.

Set:

```bash
PORT=8080
PUBLIC_RELAY_URL=wss://relay.mapdaddy.com
SESSION_TTL_MS=7200000
```

Then configure the frontend:

```bash
VITE_MAP_DADDY_RELAY_URL=wss://relay.mapdaddy.com
VITE_MAP_DADDY_API_URL=https://your-public-backend.example.com
```

## Session Creation

`POST /sessions` returns:

```json
{
  "relay_url": "wss://relay.mapdaddy.com",
  "pairing_code": "MD-123456",
  "session_secret": "generated-secret",
  "expires_at": "2026-05-14T12:00:00.000Z"
}
```

The pairing code is for human entry. The session secret protects the session from random users who guess or see a pairing code.

## Protocol

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

The relay forwards JSON only. It does not store or proxy media files. It rejects missing code, missing secret, wrong secret, expired sessions, and invalid roles.
