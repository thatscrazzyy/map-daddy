const crypto = require('crypto');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const sessions = new Map();
const DEFAULT_SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 2 * 60 * 60 * 1000);
const CLEANUP_INTERVAL_MS = Number(process.env.SESSION_CLEANUP_INTERVAL_MS || 5 * 60 * 1000);

function log(msg) {
  console.log(`[Map Daddy Relay] ${msg}`);
}

function publicRelayUrl(req) {
  if (process.env.PUBLIC_RELAY_URL) return process.env.PUBLIC_RELAY_URL;
  const protocol = req.headers['x-forwarded-proto'] === 'https' ? 'wss' : 'ws';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${protocol}://${host}`;
}

function generatePairingCode() {
  let code;
  do {
    code = `MD-${crypto.randomInt(100000, 1000000)}`;
  } while (sessions.has(code));
  return code;
}

function generateSecret() {
  return crypto.randomBytes(24).toString('base64url');
}

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function safeSend(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function isExpired(session) {
  return Date.now() >= session.expiresAt;
}

function sessionStatus(code, session) {
  return {
    type: 'room:status',
    code,
    controllerConnected: !!session.controller && session.controller.readyState === WebSocket.OPEN,
    rendererConnected: !!session.renderer && session.renderer.readyState === WebSocket.OPEN,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

function validateJoin(data) {
  if (!data.code || typeof data.code !== 'string') {
    return { error: 'Invalid pairing code or password' };
  }
  if (!data.sessionSecret || typeof data.sessionSecret !== 'string') {
    return { error: 'Invalid pairing code or password' };
  }
  if (data.role !== 'controller' && data.role !== 'renderer') {
    return { error: 'Invalid role' };
  }

  const session = sessions.get(data.code);
  if (!session || isExpired(session)) {
    if (session) sessions.delete(data.code);
    return { error: 'Invalid pairing code or password' };
  }

  const providedHash = hashSecret(data.sessionSecret);
  if (providedHash !== session.secretHash) {
    return { error: 'Invalid pairing code or password' };
  }

  return { session };
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [code, session] of sessions.entries()) {
    if (now >= session.expiresAt) {
      safeSend(session.controller, { type: 'error', message: 'Session expired' });
      safeSend(session.renderer, { type: 'error', message: 'Session expired' });
      safeSend(session.controller, { type: 'room:status', code, controllerConnected: false, rendererConnected: false });
      safeSend(session.renderer, { type: 'room:status', code, controllerConnected: false, rendererConnected: false });
      if (session.controller) session.controller.close();
      if (session.renderer) session.renderer.close();
      sessions.delete(code);
      log(`Expired session ${code} removed`);
    }
  }
}

setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL_MS);

app.get('/health', (req, res) => {
  cleanupExpiredSessions();
  res.json({ status: 'ok', sessions: sessions.size });
});

app.post('/sessions', (req, res) => {
  cleanupExpiredSessions();
  const code = generatePairingCode();
  const secret = generateSecret();
  const now = Date.now();
  const ttlMs = Number(req.body?.ttl_ms || DEFAULT_SESSION_TTL_MS);
  const expiresAt = now + Math.max(60 * 1000, Math.min(ttlMs, 24 * 60 * 60 * 1000));

  sessions.set(code, {
    code,
    secretHash: hashSecret(secret),
    controller: null,
    renderer: null,
    latestScene: null,
    createdAt: now,
    expiresAt,
    lastActivity: now
  });

  log(`Created session ${code}, expires ${new Date(expiresAt).toISOString()}`);
  res.status(201).json({
    relay_url: publicRelayUrl(req),
    pairing_code: code,
    session_secret: secret,
    expires_at: new Date(expiresAt).toISOString()
  });
});

wss.on('connection', (ws) => {
  let currentCode = null;
  let currentRole = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'join') {
        const validation = validateJoin(data);
        if (validation.error) {
          safeSend(ws, { type: 'error', message: validation.error });
          ws.close();
          return;
        }

        const session = validation.session;
        currentCode = data.code;
        currentRole = data.role;
        session[currentRole] = ws;
        session.lastActivity = Date.now();

        safeSend(ws, {
          type: 'joined',
          role: currentRole,
          code: currentCode,
          expiresAt: new Date(session.expiresAt).toISOString()
        });
        log(`${currentRole} joined session ${currentCode}`);

        const statusMsg = sessionStatus(currentCode, session);
        safeSend(session.controller, statusMsg);
        safeSend(session.renderer, statusMsg);

        if (currentRole === 'renderer' && session.latestScene) {
          safeSend(ws, {
            type: 'scene:update',
            code: currentCode,
            scene: session.latestScene
          });
        }
        return;
      }

      if (!currentCode || !currentRole) {
        safeSend(ws, { type: 'error', message: 'Join a valid session first' });
        return;
      }

      const session = sessions.get(currentCode);
      if (!session || isExpired(session)) {
        if (session) sessions.delete(currentCode);
        safeSend(ws, { type: 'error', message: 'Session expired' });
        ws.close();
        return;
      }

      session.lastActivity = Date.now();

      if (data.type === 'scene:update') {
        if (currentRole !== 'controller') {
          safeSend(ws, { type: 'error', message: 'Only controller can send scene:update' });
          return;
        }
        if (!data.scene || typeof data.scene !== 'object') {
          safeSend(ws, { type: 'error', message: 'scene:update requires a scene object' });
          return;
        }
        session.latestScene = data.scene;
        safeSend(session.renderer, { type: 'scene:update', code: currentCode, scene: data.scene });
      } else if (data.type === 'renderer:status' || data.type === 'renderer:error') {
        if (currentRole !== 'renderer') {
          safeSend(ws, { type: 'error', message: `Only renderer can send ${data.type}` });
          return;
        }
        safeSend(session.controller, { ...data, code: currentCode });
      } else if (data.type === 'ping') {
        safeSend(ws, { type: 'pong' });
      } else {
        safeSend(ws, { type: 'error', message: `Unsupported message type: ${data.type}` });
      }
    } catch (e) {
      safeSend(ws, { type: 'error', message: 'Malformed JSON message' });
      console.error('[Map Daddy Relay] Error processing message:', e.message);
    }
  });

  ws.on('close', () => {
    if (currentCode && currentRole) {
      const session = sessions.get(currentCode);
      if (session && session[currentRole] === ws) {
        session[currentRole] = null;
        session.lastActivity = Date.now();
        log(`${currentRole} disconnected from session ${currentCode}`);

        const statusMsg = sessionStatus(currentCode, session);
        safeSend(session.controller, statusMsg);
        safeSend(session.renderer, statusMsg);
      }
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
