# Map Daddy Relay Server

A lightweight WebSocket relay that connects hosted Map Daddy controllers to Raspberry Pi renderers with pairing codes.

The relay passes JSON only. It does not store, upload, or proxy media files.

## Setup

```bash
make install
make dev
```

## Production

```bash
PORT=8080 make start
```

## Environment Variables

- `PORT`: HTTP/WebSocket port, default `8080`.

## Deployment

Deploy this folder to Render, Railway, Fly.io, Heroku, or a VPS with Node.js. No database is required; room state is held in memory and inactive rooms are cleaned up.

## Health

```bash
curl http://localhost:8080/health
```
