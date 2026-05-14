# Map Daddy Relay Server

A lightweight HTTP/WebSocket relay that connects hosted Map Daddy controllers to receivers with protected pairing sessions.

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

Create a session:

```bash
curl -X POST http://localhost:8080/sessions
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

Health:

```bash
curl http://localhost:8080/health
```

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

The relay rejects missing code, missing secret, wrong secret, expired sessions, and invalid roles. Raw secrets are not logged.
