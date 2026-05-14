# Public Demo and Release Setup

## Hosted Website

Deploy `frontend/` to Vercel, Netlify, Render static sites, or any static host that can run:

```bash
npm ci
npm run build
```

Set:

```bash
VITE_MAP_DADDY_API_URL=https://your-public-backend.example.com
VITE_MAP_DADDY_RELAY_URL=wss://relay.mapdaddy.com
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=https://your-public-backend.example.com
```

The public website URL placeholder is:

```text
https://your-map-daddy-site.com
```

The controller uses `VITE_MAP_DADDY_API_URL/api/sessions/create` first. If that endpoint is not available, it falls back to the relay HTTP endpoint derived from `VITE_MAP_DADDY_RELAY_URL` and calls `POST /sessions`.

## Backend

Deploy `backend/` anywhere FastAPI is supported. Set one of:

```bash
MAP_DADDY_RELAY_SESSION_URL=https://relay.mapdaddy.com/sessions
PUBLIC_RELAY_URL=wss://relay.mapdaddy.com
```

`POST /api/sessions/create` proxies session creation to the relay. Media uploads are served from `/media`, so `VITE_MAP_DADDY_PUBLIC_BACKEND_URL` must point to the public backend URL if you use uploaded media.

## Relay

Deploy `relay/` to a Node.js host with WebSocket support.

```bash
PUBLIC_RELAY_URL=wss://relay.mapdaddy.com
SESSION_TTL_MS=7200000
PORT=8080
```

The relay keeps sessions in memory. Restarting the relay clears active sessions, which is acceptable for the public demo MVP.

## Protected Session Flow

1. Website calls `POST /api/sessions/create` or relay `POST /sessions`.
2. Relay returns `relay_url`, `pairing_code`, `session_secret`, and `expires_at`.
3. Controller joins WebSocket as:

```json
{
  "type": "join",
  "role": "controller",
  "code": "MD-123456",
  "sessionSecret": "generated-secret"
}
```

4. Receiver joins with the same code and secret.
5. Relay rejects missing code, missing secret, wrong secret, expired sessions, and invalid roles.

Secrets are long random strings. The relay stores only a SHA-256 hash in memory and does not log raw secrets.

## Receiver Releases

Build locally:

```bash
cd renderer-pi
bash scripts/build_linux.sh
```

Windows:

```powershell
cd renderer-pi
.\scripts\build_windows.ps1
```

Raspberry Pi:

```bash
cd renderer-pi
bash scripts/build_pi.sh
```

PyInstaller cannot reliably cross-compile the Raspberry Pi binary from GitHub-hosted x64 runners. Use a Raspberry Pi, a Linux ARM64 machine, or a self-hosted GitHub Actions runner.

## GitHub Releases

Tag a release:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The release workflow builds:

- `MapDaddy-Receiver-Windows-x64.exe`
- `MapDaddy-Receiver-Linux-x64`
- `MapDaddy-Receiver-RaspberryPi-arm64` only when `BUILD_PI_ARM64=true` and a matching self-hosted runner is available

The workflow fails if Windows or Linux packaging fails. The Pi job is skipped by default instead of faking a successful cross-compile.
