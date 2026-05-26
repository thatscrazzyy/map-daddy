# Map Daddy Cloudflare Worker

This Worker provides the hosted Map Daddy backend and relay:

- Scene API through KV
- Media upload/download through R2
- Pairing sessions and WebSocket relay through Durable Objects

## Setup

```bash
npm install
npx wrangler login
npx wrangler r2 bucket create map-daddy-media
npx wrangler kv namespace create SCENES
```

Put the returned KV namespace ID in `wrangler.toml`.

Deploy:

```bash
npx wrangler deploy
```

Create a pairing session with an auto-generated password:

```bash
curl -X POST https://map-daddy.YOUR_SUBDOMAIN.workers.dev/sessions
```

Create a pairing session with your own receiver password:

```bash
curl -X POST https://map-daddy.YOUR_SUBDOMAIN.workers.dev/sessions \
  -H "Content-Type: application/json" \
  -d '{"session_secret":"my-custom-password"}'
```

Use the deployed Worker URL for all frontend variables:

```text
VITE_MAP_DADDY_API_URL=https://map-daddy.YOUR_SUBDOMAIN.workers.dev
VITE_MAP_DADDY_RELAY_URL=wss://map-daddy.YOUR_SUBDOMAIN.workers.dev/ws
VITE_MAP_DADDY_PUBLIC_BACKEND_URL=https://map-daddy.YOUR_SUBDOMAIN.workers.dev
```
