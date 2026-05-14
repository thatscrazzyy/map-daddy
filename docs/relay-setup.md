# Relay Setup

The relay is a small Node.js WebSocket server. It connects one controller and one renderer by pairing code.

## Local

```bash
cd relay
make install
PORT=8080 make dev
```

Health check:

```bash
curl http://localhost:8080/health
```

## Hosted

Deploy the `relay/` directory to a Node.js host such as Render, Railway, Fly.io, or a VPS.

Set:

```bash
PORT=8080
```

Then configure the frontend:

```bash
NEXT_PUBLIC_MAP_DADDY_RELAY_URL=wss://your-relay.example.com
```

## Protocol

Renderer join:

```json
{ "type": "join", "role": "renderer", "code": "MD-123456" }
```

Controller join:

```json
{ "type": "join", "role": "controller", "code": "MD-123456" }
```

Scene update:

```json
{ "type": "scene:update", "code": "MD-123456", "scene": {} }
```

The relay forwards JSON only. It does not store or proxy media files.
