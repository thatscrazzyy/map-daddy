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
        ws.send(JSON.stringify({ type: 'error', message: 'Missing or invalid code' }));
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
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid role' }));
          return;
        }

        currentRoom = code;
        currentRole = data.role;
        room[currentRole] = ws;

        ws.send(JSON.stringify({ type: 'joined', role: currentRole, code }));
        log(`${currentRole} joined room ${code}`);

        // Broadcast room status
        const statusMsg = JSON.stringify({
          type: 'room:status',
          code,
          controllerConnected: !!room.controller && room.controller.readyState === WebSocket.OPEN,
          rendererConnected: !!room.renderer && room.renderer.readyState === WebSocket.OPEN
        });

        if (room.controller) room.controller.send(statusMsg);
        if (room.renderer) room.renderer.send(statusMsg);

        // If renderer joins and we have a latest scene, send it
        if (currentRole === 'renderer' && room.latestScene) {
          ws.send(JSON.stringify({
            type: 'scene:update',
            code,
            scene: room.latestScene
          }));
        }
      } else if (data.type === 'scene:update') {
        if (currentRole !== 'controller') {
          ws.send(JSON.stringify({ type: 'error', message: 'Only controller can send scene:update' }));
          return;
        }
        room.latestScene = data.scene;
        if (room.renderer && room.renderer.readyState === WebSocket.OPEN) {
          room.renderer.send(JSON.stringify(data));
        }
      } else if (data.type === 'renderer:status' || data.type === 'renderer:error') {
        if (currentRole !== 'renderer') {
          ws.send(JSON.stringify({ type: 'error', message: `Only renderer can send ${data.type}` }));
          return;
        }
        if (room.controller && room.controller.readyState === WebSocket.OPEN) {
          room.controller.send(JSON.stringify(data));
        }
      } else if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (e) {
      console.error('[Map Daddy Relay] Error processing message:', e);
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentRole) {
      const room = rooms[currentRoom];
      if (room) {
        room[currentRole] = null;
        log(`${currentRole} disconnected from room ${currentRoom}`);
        
        const statusMsg = JSON.stringify({
          type: 'room:status',
          code: currentRoom,
          controllerConnected: !!room.controller && room.controller.readyState === WebSocket.OPEN,
          rendererConnected: !!room.renderer && room.renderer.readyState === WebSocket.OPEN
        });

        if (room.controller && room.controller.readyState === WebSocket.OPEN) {
          room.controller.send(statusMsg);
        }
        if (room.renderer && room.renderer.readyState === WebSocket.OPEN) {
          room.renderer.send(statusMsg);
        }
      }
    }
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
});
