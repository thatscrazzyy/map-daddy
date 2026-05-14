const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const rooms = {};

function log(msg) {
  console.log(`[Map Daddy Relay] ${msg}`);
}

function safeSend(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function roomStatus(code, room) {
  return {
    type: 'room:status',
    code,
    controllerConnected: !!room.controller && room.controller.readyState === WebSocket.OPEN,
    rendererConnected: !!room.renderer && room.renderer.readyState === WebSocket.OPEN
  };
}

// Clean up stale rooms every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const code in rooms) {
    if (now - rooms[code].lastActivity > 1000 * 60 * 60) {
      log(`Cleaning up stale room: ${code}`);
      delete rooms[code];
    }
  }
}, 5 * 60 * 1000);

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentRole = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (!data.code || typeof data.code !== 'string') {
        safeSend(ws, { type: 'error', message: 'Missing or invalid code' });
        return;
      }

      const code = data.code;
      
      if (!rooms[code]) {
        rooms[code] = {
          controller: null,
          renderer: null,
          latestScene: null,
          lastActivity: Date.now()
        };
      }
      
      const room = rooms[code];
      room.lastActivity = Date.now();

      if (data.type === 'join') {
        if (data.role !== 'controller' && data.role !== 'renderer') {
          safeSend(ws, { type: 'error', message: 'Invalid role' });
          return;
        }

        currentRoom = code;
        currentRole = data.role;
        room[currentRole] = ws;

        safeSend(ws, { type: 'joined', role: currentRole, code });
        log(`${currentRole} joined room ${code}`);

        const statusMsg = roomStatus(code, room);
        safeSend(room.controller, statusMsg);
        safeSend(room.renderer, statusMsg);

        // If renderer joins and we have a latest scene, send it
        if (currentRole === 'renderer' && room.latestScene) {
          safeSend(ws, {
            type: 'scene:update',
            code,
            scene: room.latestScene
          });
        }
      } else if (data.type === 'scene:update') {
        if (currentRole !== 'controller') {
          safeSend(ws, { type: 'error', message: 'Only controller can send scene:update' });
          return;
        }
        if (!data.scene || typeof data.scene !== 'object') {
          safeSend(ws, { type: 'error', message: 'scene:update requires a scene object' });
          return;
        }
        room.latestScene = data.scene;
        safeSend(room.renderer, { type: 'scene:update', code, scene: data.scene });
      } else if (data.type === 'renderer:status' || data.type === 'renderer:error') {
        if (currentRole !== 'renderer') {
          safeSend(ws, { type: 'error', message: `Only renderer can send ${data.type}` });
          return;
        }
        safeSend(room.controller, data);
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
    if (currentRoom && currentRole) {
      const room = rooms[currentRoom];
      if (room) {
        room[currentRole] = null;
        log(`${currentRole} disconnected from room ${currentRoom}`);
        
        const statusMsg = roomStatus(currentRoom, room);
        safeSend(room.controller, statusMsg);
        safeSend(room.renderer, statusMsg);
      }
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
