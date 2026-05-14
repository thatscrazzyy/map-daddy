# Architecture

Map Daddy is split into controller, relay, backend, and receiver pieces.

```text
Hosted Web Controller -> Map Daddy Relay -> Raspberry Pi Receiver -> HDMI/Projector
```

The web controller edits scenes and sends JSON updates over WebSocket. The relay creates short-lived sessions with a human pairing code plus a session secret, then forwards JSON between one controller and one renderer. The Raspberry Pi receiver renders the last valid scene fullscreen with Pygame and OpenCV.

## Session Model

The hosted controller calls `POST /api/sessions/create` on the backend or `POST /sessions` on the relay. The response contains `relay_url`, `pairing_code`, `session_secret`, and `expires_at`.

Both clients join with:

```json
{ "type": "join", "role": "controller", "code": "MD-123456", "sessionSecret": "generated-secret" }
```

The relay rejects missing code, missing secret, wrong secret, expired sessions, and invalid roles. Secrets are not logged.

## Media Handling

Media is not sent over WebSocket. Scene JSON stores public URLs in `sources[].url`. The receiver downloads those URLs into `~/.mapdaddy/cache` and renders from the local cached file.

For the MVP, media can come from the FastAPI backend served through a public URL or Cloudflare Tunnel. Long term, the same scene model works with S3, Supabase Storage, Firebase Storage, or similar storage.

## Scene Model

The current scene format is `0.2.0`. Surfaces reference media through `source_id`; the media definition lives in `sources[]`. This keeps geometry, media, and rendering responsibilities separate.

## Local Mode

The receiver still supports local backend polling:

```bash
python3 mapdaddy_receiver.py --server http://192.168.1.25:8000
```

Relative `/media/...` URLs are resolved against the local server URL in that mode.
