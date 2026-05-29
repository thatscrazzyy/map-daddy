const SCENE_KEY = 'current_scene';
const PROJECT_PREFIX = 'project:';
const DEFAULT_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_SCENE = {
  version: '0.3.0',
  project_name: 'Map Daddy Demo',
  output: { width: 1920, height: 1080, background: '#000000' },
  sources: [],
  shapes: [
    {
      id: 'input_shape_demo',
      name: 'Demo Crop',
      type: 'quad',
      vertices: [[0, 0], [1920, 0], [1920, 1080], [0, 1080]],
      locked: false
    },
    {
      id: 'output_shape_demo',
      name: 'Demo Surface',
      type: 'quad',
      vertices: [[420, 220], [1500, 180], [1440, 880], [500, 900]],
      locked: false
    }
  ],
  mappings: [
    {
      id: 'mapping_demo',
      name: 'Demo Surface',
      source_id: '',
      input_shape_id: 'input_shape_demo',
      output_shape_id: 'output_shape_demo',
      visible: true,
      locked: false,
      solo: false,
      opacity: 1,
      blend_mode: 'normal',
      depth: 0
    }
  ],
  metadata: { created_by: 'Map Daddy', created_at: '', updated_at: '' }
};

function corsHeaders(request, env) {
  const configured = env.CORS_ORIGINS || '*';
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = configured === '*'
    ? '*'
    : configured.split(',').map((item) => item.trim()).filter(Boolean).includes(origin)
      ? origin
      : configured.split(',')[0].trim();
  return {
    'Access-Control-Allow-Origin': allowOrigin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

function jsonResponse(request, env, data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function textResponse(request, env, message, status = 200) {
  return new Response(message, {
    status,
    headers: {
      ...corsHeaders(request, env),
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
}

function publicBaseUrl(request, env) {
  if (env.PUBLIC_WORKER_URL) return env.PUBLIC_WORKER_URL.replace(/\/$/, '');
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

function publicWebSocketUrl(request, env, code) {
  const base = publicBaseUrl(request, env).replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  return `${base}/ws?code=${encodeURIComponent(code)}`;
}

function generatePairingCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return `MD-${100000 + (array[0] % 900000)}`;
}

function generateSecret() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sessionSecretFromBody(body) {
  const raw = body.session_secret ?? body.sessionSecret ?? body.password;
  if (typeof raw !== 'string') return null;
  const secret = raw.trim();
  return secret ? secret : null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeUploadName(name) {
  const raw = (name || 'upload.bin').split(/[\\/]/).pop();
  const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+|[._]+$/g, '') || 'upload.bin';
  const dot = cleaned.lastIndexOf('.');
  const stem = (dot > 0 ? cleaned.slice(0, dot) : cleaned).slice(0, 80) || 'upload';
  const ext = dot > 0 ? cleaned.slice(dot, dot + 16) : '';
  return `${Date.now()}_${stem}${ext}`;
}

function generateProjectId() {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((byte) => byte.toString(36).padStart(2, '0')).join('').slice(0, 12);
  return `project_${token}`;
}

function safeProjectId(projectId) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(projectId || '')) return null;
  return projectId;
}

function defaultProject(name = 'Untitled Project', id = generateProjectId()) {
  return {
    id,
    name: name || 'Untitled Project',
    canvas: { width: 1920, height: 1080, backgroundColor: '#000000' },
    media: [],
    surfaces: [],
    updatedAt: new Date().toISOString()
  };
}

function normalizeProject(project = {}) {
  const id = safeProjectId(project.id) || generateProjectId();
  const canvas = project.canvas || {};
  return {
    id,
    name: project.name || 'Untitled Project',
    canvas: {
      width: Number(canvas.width || 1920),
      height: Number(canvas.height || 1080),
      backgroundColor: canvas.backgroundColor || '#000000'
    },
    media: (project.media || []).map((item, index) => ({
      id: item.id || `media_${index + 1}`,
      type: item.type === 'video' ? 'video' : 'image',
      url: item.url || '',
      name: item.name || item.id || `Media ${index + 1}`
    })),
    surfaces: (project.surfaces || []).map((surface, index) => ({
      id: surface.id || `surface_${index + 1}`,
      name: surface.name || `Surface ${index + 1}`,
      mediaId: surface.mediaId || '',
      visible: surface.visible !== false,
      opacity: Number(surface.opacity ?? 1),
      blendMode: surface.blendMode || 'source-over',
      sourceRect: {
        x: Number(surface.sourceRect?.x || 0),
        y: Number(surface.sourceRect?.y || 0),
        width: Number(surface.sourceRect?.width || canvas.width || 1920),
        height: Number(surface.sourceRect?.height || canvas.height || 1080)
      },
      destinationQuad: (surface.destinationQuad?.length === 4 ? surface.destinationQuad : [
        { x: 480, y: 270 },
        { x: 1440, y: 270 },
        { x: 1440, y: 810 },
        { x: 480, y: 810 }
      ]).map((point) => ({ x: Number(point.x || 0), y: Number(point.y || 0) }))
    })),
    updatedAt: project.updatedAt || new Date().toISOString()
  };
}

function projectSummary(project) {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    surfaceCount: project.surfaces?.length || 0,
    mediaCount: project.media?.length || 0
  };
}

function contentTypeForKey(key) {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.webm')) return 'video/webm';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

async function handleCreateSession(request, env) {
  const body = await request.json().catch(() => ({}));
  const code = generatePairingCode();
  const customSecret = sessionSecretFromBody(body);
  if (customSecret && (customSecret.length < 4 || customSecret.length > 128)) {
    return jsonResponse(request, env, { detail: 'Password must be 4 to 128 characters.' }, 400);
  }
  const secret = customSecret || generateSecret();
  const now = Date.now();
  const requestedTtl = Number(body.ttl_ms || DEFAULT_SESSION_TTL_MS);
  const ttl = Math.max(60 * 1000, Math.min(requestedTtl, MAX_SESSION_TTL_MS));
  const expiresAt = now + ttl;
  const room = env.ROOMS.get(env.ROOMS.idFromName(code));
  await room.fetch('https://room/create', {
    method: 'POST',
    body: JSON.stringify({
      code,
      secretHash: await sha256(secret),
      createdAt: now,
      expiresAt
    })
  });
  return jsonResponse(request, env, {
    relay_url: publicWebSocketUrl(request, env, code),
    pairing_code: code,
    session_secret: secret,
    expires_at: new Date(expiresAt).toISOString()
  }, 201);
}

async function handleMediaUpload(request, env) {
  const form = await request.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') {
    return jsonResponse(request, env, { detail: 'file is required' }, 400);
  }
  const key = safeUploadName(file.name);
  await env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type || contentTypeForKey(key)
    }
  });
  return jsonResponse(request, env, { url: `/media/${key}`, filename: key });
}

async function handleMediaGet(request, env, key) {
  const object = await env.MEDIA.get(key);
  if (!object) return textResponse(request, env, 'Not found', 404);
  const headers = new Headers(corsHeaders(request, env));
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
}

async function handleSceneGet(request, env) {
  const stored = await env.SCENES.get(SCENE_KEY, 'json');
  return jsonResponse(request, env, stored || DEFAULT_SCENE);
}

async function handleScenePost(request, env) {
  const scene = await request.json();
  const next = {
    ...scene,
    version: scene.version || '0.3.0',
    metadata: {
      ...(scene.metadata || {}),
      created_by: scene.metadata?.created_by || 'Map Daddy',
      created_at: scene.metadata?.created_at || '',
      updated_at: new Date().toISOString()
    }
  };
  await env.SCENES.put(SCENE_KEY, JSON.stringify(next));
  return jsonResponse(request, env, { status: 'success' });
}

async function handleProjectsList(request, env) {
  const listing = await env.SCENES.list({ prefix: PROJECT_PREFIX });
  const projects = [];
  for (const key of listing.keys) {
    const stored = await env.SCENES.get(key.name, 'json');
    if (stored) projects.push(projectSummary(normalizeProject(stored)));
  }
  projects.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  return jsonResponse(request, env, projects);
}

async function handleProjectCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const project = normalizeProject(defaultProject(body.name || 'Untitled Project'));
  await env.SCENES.put(`${PROJECT_PREFIX}${project.id}`, JSON.stringify(project));
  return jsonResponse(request, env, project, 201);
}

async function handleProjectGet(request, env, projectId) {
  const id = safeProjectId(projectId);
  if (!id) return jsonResponse(request, env, { detail: 'Invalid project id' }, 400);
  const stored = await env.SCENES.get(`${PROJECT_PREFIX}${id}`, 'json');
  if (!stored) return jsonResponse(request, env, { detail: 'Project not found' }, 404);
  return jsonResponse(request, env, normalizeProject(stored));
}

async function handleProjectPut(request, env, projectId) {
  const id = safeProjectId(projectId);
  if (!id) return jsonResponse(request, env, { detail: 'Invalid project id' }, 400);
  const body = await request.json();
  const project = normalizeProject({ ...body, id, updatedAt: new Date().toISOString() });
  await env.SCENES.put(`${PROJECT_PREFIX}${id}`, JSON.stringify(project));
  return jsonResponse(request, env, project);
}

async function handleProjectDelete(request, env, projectId) {
  const id = safeProjectId(projectId);
  if (!id) return jsonResponse(request, env, { detail: 'Invalid project id' }, 400);
  const key = `${PROJECT_PREFIX}${id}`;
  const stored = await env.SCENES.get(key);
  if (!stored) return jsonResponse(request, env, { detail: 'Project not found' }, 404);
  await env.SCENES.delete(key);
  return jsonResponse(request, env, { status: 'success' });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return jsonResponse(request, env, { status: 'ok' });
    }
    if ((url.pathname === '/sessions' || url.pathname === '/api/sessions/create') && request.method === 'POST') {
      return handleCreateSession(request, env);
    }
    if (url.pathname === '/api/current-scene' && request.method === 'GET') {
      return handleSceneGet(request, env);
    }
    if (url.pathname === '/api/current-scene' && request.method === 'POST') {
      return handleScenePost(request, env);
    }
    if (url.pathname === '/api/media/upload' && request.method === 'POST') {
      return handleMediaUpload(request, env);
    }
    if (url.pathname === '/api/projects' && request.method === 'GET') {
      return handleProjectsList(request, env);
    }
    if (url.pathname === '/api/projects' && request.method === 'POST') {
      return handleProjectCreate(request, env);
    }
    if (url.pathname.startsWith('/api/projects/') && request.method === 'GET') {
      return handleProjectGet(request, env, decodeURIComponent(url.pathname.slice('/api/projects/'.length)));
    }
    if (url.pathname.startsWith('/api/projects/') && request.method === 'PUT') {
      return handleProjectPut(request, env, decodeURIComponent(url.pathname.slice('/api/projects/'.length)));
    }
    if (url.pathname.startsWith('/api/projects/') && request.method === 'DELETE') {
      return handleProjectDelete(request, env, decodeURIComponent(url.pathname.slice('/api/projects/'.length)));
    }
    if (url.pathname.startsWith('/media/') && request.method === 'GET') {
      return handleMediaGet(request, env, decodeURIComponent(url.pathname.slice('/media/'.length)));
    }
    if (url.pathname === '/ws') {
      const code = url.searchParams.get('code');
      return env.ROOMS.get(env.ROOMS.idFromName(code || 'project-realtime')).fetch(request);
    }
    return textResponse(request, env, 'Not found', 404);
  }
};

export class ProjectionRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.controller = null;
    this.renderer = null;
    this.projectRooms = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/create') {
      const session = await request.json();
      await this.state.storage.put('session', session);
      await this.state.storage.delete('latestScene');
      return new Response('ok');
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    this.handleSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  safeSend(socket, payload) {
    try {
      socket?.send(JSON.stringify(payload));
    } catch (_) {
      // Closed sockets throw; status updates are best effort.
    }
  }

  getProjectRoom(projectId) {
    if (!this.projectRooms.has(projectId)) {
      this.projectRooms.set(projectId, {
        editors: new Set(),
        projectors: new Set(),
        latestProject: null
      });
    }
    return this.projectRooms.get(projectId);
  }

  projectStatus(projectId, room) {
    return {
      type: 'project:presence',
      projectId,
      editorCount: room.editors.size,
      projectorCount: room.projectors.size
    };
  }

  broadcastProject(projectId, payload) {
    const room = this.projectRooms.get(projectId);
    if (!room) return;
    for (const socket of [...room.editors, ...room.projectors]) {
      this.safeSend(socket, payload);
    }
  }

  leaveProjectRoom(socket, projectId, projectRole) {
    if (!projectId || !projectRole) return;
    const room = this.projectRooms.get(projectId);
    if (!room) return;
    if (projectRole === 'editor') room.editors.delete(socket);
    if (projectRole === 'projector') room.projectors.delete(socket);
    if (room.editors.size === 0 && room.projectors.size === 0 && !room.latestProject) {
      this.projectRooms.delete(projectId);
      return;
    }
    this.broadcastProject(projectId, this.projectStatus(projectId, room));
  }

  async sessionStatus(code) {
    const session = await this.state.storage.get('session');
    return {
      type: 'room:status',
      code,
      controllerConnected: !!this.controller,
      rendererConnected: !!this.renderer,
      expiresAt: session ? new Date(session.expiresAt).toISOString() : ''
    };
  }

  async validateJoin(data) {
    const session = await this.state.storage.get('session');
    if (!session || Date.now() >= session.expiresAt) {
      return { error: 'Invalid pairing code or password' };
    }
    if (data.code !== session.code || !data.sessionSecret || !data.role) {
      return { error: 'Invalid pairing code or password' };
    }
    const providedHash = await sha256(data.sessionSecret);
    if (providedHash !== session.secretHash) {
      return { error: 'Invalid pairing code or password' };
    }
    if (data.role !== 'controller' && data.role !== 'renderer') {
      return { error: 'Invalid role' };
    }
    return { session };
  }

  handleSocket(socket) {
    let role = null;
    let code = null;
    let projectId = null;
    let projectRole = null;

    socket.addEventListener('message', async (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (_) {
        this.safeSend(socket, { type: 'error', message: 'Malformed JSON message' });
        return;
      }

      if (data.type === 'project:join') {
        const nextProjectId = typeof data.projectId === 'string' ? data.projectId.trim() : '';
        const nextRole = data.role === 'projector' ? 'projector' : data.role === 'editor' ? 'editor' : '';
        if (!nextProjectId || !nextRole) {
          this.safeSend(socket, { type: 'error', message: 'project:join requires projectId and role' });
          return;
        }
        this.leaveProjectRoom(socket, projectId, projectRole);
        projectId = nextProjectId;
        projectRole = nextRole;
        const room = this.getProjectRoom(projectId);
        room[projectRole === 'editor' ? 'editors' : 'projectors'].add(socket);
        this.safeSend(socket, { type: 'project:joined', projectId, role: projectRole });
        this.broadcastProject(projectId, this.projectStatus(projectId, room));
        if (projectRole === 'projector' && room.latestProject) {
          this.safeSend(socket, { type: 'project:update', projectId, project: room.latestProject });
        }
        return;
      }

      if (data.type === 'project:update') {
        if (!projectId || projectRole !== 'editor') {
          this.safeSend(socket, { type: 'error', message: 'Only a joined editor can send project:update' });
          return;
        }
        if (!data.project || typeof data.project !== 'object') {
          this.safeSend(socket, { type: 'error', message: 'project:update requires a project object' });
          return;
        }
        const room = this.getProjectRoom(projectId);
        room.latestProject = data.project;
        for (const projector of [...room.projectors]) {
          this.safeSend(projector, { type: 'project:update', projectId, project: data.project });
        }
        this.safeSend(socket, this.projectStatus(projectId, room));
        return;
      }

      if (data.type === 'join') {
        const validation = await this.validateJoin(data);
        if (validation.error) {
          this.safeSend(socket, { type: 'error', message: validation.error });
          socket.close();
          return;
        }
        role = data.role;
        code = data.code;
        if (role === 'controller') this.controller = socket;
        if (role === 'renderer') this.renderer = socket;
        this.safeSend(socket, {
          type: 'joined',
          role,
          code,
          expiresAt: new Date(validation.session.expiresAt).toISOString()
        });

        const status = await this.sessionStatus(code);
        this.safeSend(this.controller, status);
        this.safeSend(this.renderer, status);

        if (role === 'renderer') {
          const latestScene = await this.state.storage.get('latestScene');
          if (latestScene) this.safeSend(socket, { type: 'scene:update', code, scene: latestScene });
        }
        return;
      }

      if (!role || !code) {
        this.safeSend(socket, { type: 'error', message: 'Join a valid session first' });
        return;
      }

      if (data.type === 'scene:update') {
        if (role !== 'controller') {
          this.safeSend(socket, { type: 'error', message: 'Only controller can send scene:update' });
          return;
        }
        if (!data.scene || typeof data.scene !== 'object') {
          this.safeSend(socket, { type: 'error', message: 'scene:update requires a scene object' });
          return;
        }
        await this.state.storage.put('latestScene', data.scene);
        this.safeSend(this.renderer, { type: 'scene:update', code, scene: data.scene });
      } else if (data.type === 'renderer:status' || data.type === 'renderer:error') {
        if (role !== 'renderer') {
          this.safeSend(socket, { type: 'error', message: `Only renderer can send ${data.type}` });
          return;
        }
        this.safeSend(this.controller, { ...data, code });
      } else if (data.type === 'ping') {
        this.safeSend(socket, { type: 'pong' });
      } else {
        this.safeSend(socket, { type: 'error', message: `Unsupported message type: ${data.type}` });
      }
    });

    socket.addEventListener('close', async () => {
      this.leaveProjectRoom(socket, projectId, projectRole);
      if (role === 'controller' && this.controller === socket) this.controller = null;
      if (role === 'renderer' && this.renderer === socket) this.renderer = null;
      if (code) {
        const status = await this.sessionStatus(code);
        this.safeSend(this.controller, status);
        this.safeSend(this.renderer, status);
      }
    });
  }
}
