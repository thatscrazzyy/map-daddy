# Map Daddy Relay Server

A lightweight WebSocket relay server to connect Map Daddy web controllers to Raspberry Pi renderers over the internet using pairing codes.

## Setup
```bash
npm install
npm start
```

## Environment Variables
- `PORT`: Port to run the server on (default: 8080)

## Deployment
You can deploy this folder to Render, Railway, Fly.io, or Heroku. It only requires a standard Node.js environment.
No database is required; state is held in-memory.
