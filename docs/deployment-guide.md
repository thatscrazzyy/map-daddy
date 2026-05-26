# Deployment Guide

Recommended low-setup deployment:

```text
GitHub Pages frontend -> Cloudflare Worker backend/relay -> R2 media storage
```

The Cloudflare Worker replaces the separate FastAPI backend and Node relay for hosted use. Local development can still use the existing FastAPI backend and Node relay.

## What Cloudflare Provides

- API:
  - `GET /api/current-scene`
  - `POST /api/current-scene`
  - `POST /api/media/upload`
  - `POST /api/sessions/create`
- Media:
  - `GET /media/...` from R2
- Relay:
  - `WebSocket /ws?code=MD-123456`
  - Durable Object room per pairing code

Media is not sent over WebSocket. Uploaded media goes to R2 and receivers download it over HTTPS.

## 1. Push To GitHub

```bash
git add .
git commit -m "Add Cloudflare deployment"
git push origin main
```

## 2. Create Cloudflare Storage

Install Wrangler locally:

```bash
cd cloudflare/worker
npm install
npx wrangler login
```

Create the R2 bucket:

```bash
npx wrangler r2 bucket create map-daddy-media
```

Create the KV namespace:

```bash
npx wrangler kv namespace create SCENES
```

Copy the returned KV namespace ID into `cloudflare/worker/wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SCENES"
id = "your-real-kv-namespace-id"
```

## 3. Deploy Cloudflare Worker

From `cloudflare/worker`:

```bash
npx wrangler deploy
```

Your Worker URL will look like:

```text
https://map-daddy.YOUR_SUBDOMAIN.workers.dev
```

The WebSocket URL is:

```text
wss://map-daddy.YOUR_SUBDOMAIN.workers.dev/ws
```

The controller receives a code-specific relay URL automatically when it creates a session.

## 4. Deploy Frontend To GitHub Pages

In GitHub:

```text
Repository -> Settings -> Pages -> Source: GitHub Actions
```

Set repository variables:

```text
VITE_MAP_DADDY_API_URL=https://map-daddy.YOUR_SUBDOMAIN.workers.dev
VITE_MAP_DADDY_RELAY_URL=wss://map-daddy.YOUR_SUBDOMAIN.workers.dev/ws
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=https://map-daddy.YOUR_SUBDOMAIN.workers.dev
```

Then run:

```text
Actions -> Deploy Frontend to GitHub Pages -> Run workflow
```

Or push to `main`.

## 5. Test Browser To Receiver

Open your GitHub Pages URL.

1. Click `Start Session`.
2. Copy the pairing code and password.
3. On the receiver:

```bash
python3 mapdaddy_receiver.py --relay wss://map-daddy.YOUR_SUBDOMAIN.workers.dev/ws --code MD-123456 --session-secret pasted-password
```

The receiver automatically appends the pairing code as a WebSocket query parameter for Cloudflare Durable Object routing.

## Optional Vercel Frontend

You can still deploy the frontend to Vercel with:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Set the same frontend environment variables, pointing at the Cloudflare Worker.

## Optional Render Legacy Services

The Docker files and `render.yaml` remain for a traditional deployment:

```text
Frontend -> FastAPI backend -> Node WebSocket relay
```

For easiest public use, prefer GitHub Pages + Cloudflare Worker.
