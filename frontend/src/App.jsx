import React, { useEffect, useRef, useState } from 'react';
import { Copy, Monitor, PlusSquare, Save, Upload, Wifi, XCircle } from 'lucide-react';

const DEV_BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');
const API_URL = import.meta.env.VITE_MAP_DADDY_API_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_API_URL || DEV_BACKEND_URL;
const RELAY_URL = import.meta.env.VITE_MAP_DADDY_RELAY_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_RELAY_URL || (import.meta.env.PROD ? '' : 'ws://localhost:8080');
const PUBLIC_BACKEND_URL = import.meta.env.VITE_MAP_DADDY_PUBLIC_BACKEND_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_PUBLIC_BACKEND_URL || API_URL;

function httpUrlFromRelay(relayUrl) {
  if (!relayUrl) return '';
  if (relayUrl.startsWith('wss://')) return relayUrl.replace('wss://', 'https://');
  if (relayUrl.startsWith('ws://')) return relayUrl.replace('ws://', 'http://');
  return relayUrl;
}

function defaultScene() {
  return {
    version: '0.2.0',
    project_name: 'Map Daddy Demo',
    output: { width: 1920, height: 1080, background: '#000000' },
    sources: [],
    surfaces: [{
      id: 'surface_demo',
      name: 'Demo Surface',
      type: 'quad',
      source_id: '',
      source_points: [[0, 0], [1920, 0], [1920, 1080], [0, 1080]],
      destination_points: [[420, 220], [1500, 180], [1440, 880], [500, 900]],
      opacity: 1,
      visible: true,
      locked: false,
      blend_mode: 'normal'
    }],
    metadata: { created_by: 'Map Daddy', created_at: '', updated_at: '' }
  };
}

function normalizeSceneMediaUrls(scene, publicBackendUrl) {
  if (!scene) return scene;
  const normalized = JSON.parse(JSON.stringify(scene));
  normalized.sources = normalized.sources || [];
  normalized.sources.forEach((source) => {
    if (source.url && source.url.startsWith('/media/') && publicBackendUrl) {
      source.url = publicBackendUrl.replace(/\/$/, '') + source.url;
    }
  });
  return normalized;
}

function guessSourceType(url, fileType = '') {
  if (fileType.startsWith('video/')) return 'video';
  const lower = (url || '').split('?')[0].toLowerCase();
  return lower.match(/\.(mp4|mov|mkv|avi|webm)$/) ? 'video' : 'image';
}

function migrateScene(scene) {
  const migrated = JSON.parse(JSON.stringify(scene || defaultScene()));
  const canvas = migrated.canvas || {};
  const output = migrated.output || {};
  migrated.version = migrated.version || '0.2.0';
  migrated.project_name = migrated.project_name || 'Map Daddy Project';
  migrated.output = {
    width: Number(output.width || canvas.width || 1920),
    height: Number(output.height || canvas.height || 1080),
    background: output.background || '#000000'
  };
  delete migrated.canvas;

  migrated.sources = migrated.sources || [];
  const byUrl = new Map(migrated.sources.filter((s) => s.url).map((s) => [s.url, s]));
  migrated.surfaces = (migrated.surfaces || []).map((surface, index) => {
    const next = {
      type: 'quad',
      visible: true,
      locked: false,
      opacity: 1.0,
      blend_mode: 'normal',
      ...surface
    };
    if (next.media && !next.source_id) {
      let source = byUrl.get(next.media);
      if (!source) {
        source = {
          id: `source_${index + 1}`,
          name: `${next.name || 'Surface'} Media`,
          type: guessSourceType(next.media),
          url: next.media,
          width: migrated.output.width,
          height: migrated.output.height,
          loop: true,
          muted: true
        };
        migrated.sources.push(source);
        byUrl.set(next.media, source);
      }
      next.source_id = source.id;
    }
    delete next.media;
    return next;
  });
  if (migrated.surfaces.length === 0) return defaultScene();
  migrated.metadata = migrated.metadata || { created_by: 'Map Daddy', created_at: '', updated_at: '' };
  return migrated;
}

function getSceneWidth(scene) {
  return scene?.output?.width || 1920;
}

function getSceneHeight(scene) {
  return scene?.output?.height || 1080;
}

function copyText(value) {
  if (navigator.clipboard && value) navigator.clipboard.writeText(value);
}

function App() {
  const [scene, setScene] = useState(null);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState(null);
  const [draggingPoint, setDraggingPoint] = useState(null);
  const [session, setSession] = useState(null);
  const [relayStatus, setRelayStatus] = useState('idle');
  const [rendererConnected, setRendererConnected] = useState(false);
  const [rendererStatus, setRendererStatus] = useState('');
  const [sessionError, setSessionError] = useState('');

  const svgRef = useRef(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);
  const reconnectRef = useRef(null);
  const joinedRef = useRef(false);
  const sessionRef = useRef(null);

  useEffect(() => {
    fetchScene();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const fetchScene = async () => {
    if (!API_URL) {
      setScene(defaultScene());
      return;
    }
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/current-scene`);
      const data = await res.json();
      setScene(data && data.surfaces ? migrateScene(data) : defaultScene());
    } catch (e) {
      console.error('Failed to fetch scene, using demo scene', e);
      setScene(defaultScene());
    }
  };

  const saveSceneLocally = async (newScene) => {
    if (!API_URL) {
      setSessionError('No API URL configured for saving scenes.');
      return;
    }
    const sceneToSave = migrateScene(newScene || scene);
    try {
      await fetch(`${API_URL.replace(/\/$/, '')}/api/current-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sceneToSave)
      });
    } catch (e) {
      console.error('Failed to save scene', e);
      setSessionError('Could not save scene to the backend.');
    }
  };

  const createSession = async () => {
    const apiBase = (API_URL || httpUrlFromRelay(RELAY_URL)).replace(/\/$/, '');
    const endpoints = [`${apiBase}/api/sessions/create`, `${httpUrlFromRelay(RELAY_URL).replace(/\/$/, '')}/sessions`];
    let lastError = null;

    for (const endpoint of endpoints) {
      if (!endpoint || endpoint === '/api/sessions/create') continue;
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        if (res.ok) return res.json();
        lastError = new Error(`${endpoint} returned ${res.status}`);
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError || new Error('Session endpoint is not configured.');
  };

  const startSession = async () => {
    setSessionError('');
    setRelayStatus('creating');
    setRendererConnected(false);
    try {
      const created = await createSession();
      const nextSession = {
        relayUrl: created.relay_url || RELAY_URL,
        pairingCode: created.pairing_code,
        sessionSecret: created.session_secret,
        expiresAt: created.expires_at
      };
      setSession(nextSession);
      sessionRef.current = nextSession;
      connectController(nextSession);
    } catch (e) {
      console.error('Failed to create projection session', e);
      setRelayStatus('idle');
      setSessionError('Could not start a projection session. Check the relay/backend session endpoint.');
    }
  };

  const connectController = (activeSession) => {
    if (!activeSession?.relayUrl || !activeSession?.pairingCode || !activeSession?.sessionSecret) return;
    if (wsRef.current) wsRef.current.close();
    joinedRef.current = false;
    setRelayStatus('connecting');

    const ws = new WebSocket(activeSession.relayUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'join',
        role: 'controller',
        code: activeSession.pairingCode,
        sessionSecret: activeSession.sessionSecret
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'joined') {
          joinedRef.current = true;
          setRelayStatus('waiting');
          if (scene) sendSceneUpdate(scene, ws, activeSession);
        } else if (msg.type === 'room:status') {
          setRendererConnected(!!msg.rendererConnected);
          setRelayStatus(msg.rendererConnected ? 'connected' : 'waiting');
          if (msg.rendererConnected && scene) sendSceneUpdate(scene, ws, activeSession);
        } else if (msg.type === 'renderer:status') {
          setRendererStatus(msg.status);
        } else if (msg.type === 'error') {
          setSessionError(msg.message || 'Relay error');
          setRelayStatus('error');
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    ws.onclose = () => {
      joinedRef.current = false;
      if (sessionRef.current) {
        setRelayStatus('reconnecting');
        reconnectRef.current = setTimeout(() => connectController(sessionRef.current), 3000);
      } else {
        setRelayStatus('idle');
      }
    };

    ws.onerror = () => {
      setSessionError('WebSocket connection failed.');
    };
  };

  const endSession = () => {
    sessionRef.current = null;
    joinedRef.current = false;
    if (reconnectRef.current) clearTimeout(reconnectRef.current);
    if (wsRef.current) wsRef.current.close();
    setSession(null);
    setRendererConnected(false);
    setRendererStatus('');
    setRelayStatus('idle');
  };

  const sendSceneUpdate = (currentScene, ws = wsRef.current, activeSession = sessionRef.current) => {
    if (ws && ws.readyState === WebSocket.OPEN && joinedRef.current && activeSession?.pairingCode) {
      const publicScene = normalizeSceneMediaUrls(migrateScene(currentScene), PUBLIC_BACKEND_URL);
      ws.send(JSON.stringify({
        type: 'scene:update',
        code: activeSession.pairingCode,
        sessionSecret: activeSession.sessionSecret,
        scene: publicScene
      }));
    }
  };

  const handleSceneChange = (newScene) => {
    const migratedScene = migrateScene(newScene);
    setScene(migratedScene);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveSceneLocally(migratedScene);
      sendSceneUpdate(migratedScene);
    }, 100);
  };

  const handleMediaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !API_URL) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/media/upload`, { method: 'POST', body: formData });
      const data = await res.json();

      if (selectedSurfaceId && scene) {
        const newScene = migrateScene(scene);
        newScene.sources = [...(newScene.sources || [])];
        const surface = newScene.surfaces.find((s) => s.id === selectedSurfaceId);
        if (surface) {
          const sourceId = `source_${Date.now()}`;
          newScene.sources.push({
            id: sourceId,
            name: file.name,
            type: guessSourceType(data.url, file.type),
            url: data.url,
            width: getSceneWidth(newScene),
            height: getSceneHeight(newScene),
            loop: true,
            muted: true
          });
          surface.source_id = sourceId;
          handleSceneChange(newScene);
        }
      } else {
        setSessionError('Select a surface before assigning media.');
      }
    } catch (e) {
      console.error('Upload failed', e);
      setSessionError('Media upload failed.');
    }
  };

  const addSurface = () => {
    const newScene = migrateScene(scene);
    const newId = `surface_${Date.now()}`;
    const width = getSceneWidth(newScene);
    const height = getSceneHeight(newScene);
    newScene.surfaces.push({
      id: newId,
      name: `New Surface ${newScene.surfaces.length + 1}`,
      type: 'quad',
      source_id: '',
      source_points: [[0, 0], [width, 0], [width, height], [0, height]],
      destination_points: [
        [Math.round(width * 0.2), Math.round(height * 0.25)],
        [Math.round(width * 0.8), Math.round(height * 0.25)],
        [Math.round(width * 0.8), Math.round(height * 0.75)],
        [Math.round(width * 0.2), Math.round(height * 0.75)]
      ],
      opacity: 1.0,
      visible: true,
      locked: false,
      blend_mode: 'normal'
    });
    setSelectedSurfaceId(newId);
    handleSceneChange(newScene);
  };

  const handlePointerDown = (surfaceId, pointIndex, e) => {
    e.stopPropagation();
    setDraggingPoint({ surfaceId, pointIndex });
    setSelectedSurfaceId(surfaceId);
  };

  const handlePointerMove = (e) => {
    if (!draggingPoint || !scene || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newScene = migrateScene(scene);
    const surface = newScene.surfaces.find((s) => s.id === draggingPoint.surfaceId);
    if (surface) {
      const scaleX = getSceneWidth(scene) / rect.width;
      const scaleY = getSceneHeight(scene) / rect.height;
      surface.destination_points[draggingPoint.pointIndex] = [
        Math.max(0, Math.min(getSceneWidth(scene), Math.round(x * scaleX))),
        Math.max(0, Math.min(getSceneHeight(scene), Math.round(y * scaleY)))
      ];
      handleSceneChange(newScene);
    }
  };

  const handlePointerUp = () => {
    if (draggingPoint) setDraggingPoint(null);
  };

  if (!scene) return <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading Map Daddy...</div>;

  const sessionExpires = session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      <header className="border-b border-gray-800 bg-gray-900/70 backdrop-blur-md shrink-0">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-[220px]">
            <Monitor className="text-emerald-500" />
            <div>
              <h1 className="text-xl font-bold text-white">Map Daddy</h1>
              <p className="text-xs text-gray-400">Public projection controller demo</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!session ? (
              <button onClick={startSession} disabled={relayStatus === 'creating'} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 rounded-md transition-colors text-sm font-medium">
                <Wifi size={16} /> {relayStatus === 'creating' ? 'Starting...' : 'Start Projection Session'}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3 bg-gray-800 py-2 px-3 rounded-md border border-gray-700">
                <div>
                  <span className="text-xs text-gray-400 block">Pairing Code</span>
                  <button onClick={() => copyText(session.pairingCode)} className="font-mono text-emerald-400 font-bold flex items-center gap-2">
                    {session.pairingCode}<Copy size={12} />
                  </button>
                </div>
                <div className="w-px h-9 bg-gray-700" />
                <div>
                  <span className="text-xs text-gray-400 block">Password</span>
                  <button onClick={() => copyText(session.sessionSecret)} className="font-mono text-cyan-300 font-bold flex items-center gap-2">
                    {session.sessionSecret}<Copy size={12} />
                  </button>
                </div>
                <div className="w-px h-9 bg-gray-700" />
                <div className="min-w-[135px]">
                  <span className="text-xs text-gray-400 block">Receiver</span>
                  <span className="text-sm flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${rendererConnected ? 'bg-emerald-500' : 'bg-yellow-500 animate-pulse'}`} />
                    {rendererConnected ? 'Connected' : 'Waiting'}
                  </span>
                </div>
                <button onClick={endSession} className="p-1.5 hover:bg-gray-700 rounded text-red-400 hover:text-red-300" title="End Session">
                  <XCircle size={18} />
                </button>
              </div>
            )}

            <button onClick={() => saveSceneLocally(scene)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors text-sm font-medium">
              <Save size={16} /> Save
            </button>
          </div>
        </div>

        <div className="px-6 pb-4 flex flex-wrap gap-3 text-sm text-gray-300">
          <button onClick={() => document.getElementById('scene-editor')?.scrollIntoView({ block: 'start' })} className="text-emerald-300 hover:text-emerald-200">
            Launch Controller
          </button>
          <span>Launch controller: ready</span>
          <span>Relay: {relayStatus}</span>
          {sessionExpires && <span>Expires: {sessionExpires}</span>}
          {rendererStatus && <span>Receiver status: {rendererStatus}</span>}
          {sessionError && <span className="text-red-300">{sessionError}</span>}
        </div>
      </header>

      <div id="scene-editor" className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-gray-800 bg-gray-900/30 p-4 flex flex-col gap-6 overflow-y-auto">
          <div className="flex-1">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Surfaces</h2>
            <div className="flex flex-col gap-2">
              {scene.surfaces.map((s) => (
                <button key={s.id} onClick={() => setSelectedSurfaceId(s.id)} className={`text-left px-3 py-2 rounded-md text-sm transition-all ${selectedSurfaceId === s.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-gray-800 text-gray-300 border border-transparent'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <button onClick={addSurface} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-500 rounded-md transition-colors text-sm font-medium">
            <PlusSquare size={16} /> Add Surface
          </button>
        </aside>

        <main className="flex-1 bg-black relative flex items-center justify-center p-8 overflow-hidden" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
          <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-lg shadow-2xl border border-gray-800 overflow-hidden" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
            <svg ref={svgRef} viewBox={`0 0 ${getSceneWidth(scene)} ${getSceneHeight(scene)}`} className="absolute inset-0 w-full h-full touch-none">
              {scene.surfaces.map((surface) => {
                const isSelected = surface.id === selectedSurfaceId;
                const pts = surface.destination_points;
                const pathData = `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]} L ${pts[2][0]},${pts[2][1]} L ${pts[3][0]},${pts[3][1]} Z`;
                return (
                  <g key={surface.id} className={!surface.visible ? 'opacity-0' : ''}>
                    <path d={pathData} fill={isSelected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'} stroke={isSelected ? '#10b981' : '#4b5563'} strokeWidth="4" onClick={() => setSelectedSurfaceId(surface.id)} className="cursor-pointer transition-colors hover:stroke-emerald-400" />
                    {isSelected && pts.map((pt, i) => (
                      <circle key={i} cx={pt[0]} cy={pt[1]} r="20" fill="#fff" stroke="#10b981" strokeWidth="4" className="cursor-move" onPointerDown={(e) => handlePointerDown(surface.id, i, e)} />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </main>

        <aside className="w-80 border-l border-gray-800 bg-gray-900/30 p-4 flex flex-col gap-6 overflow-y-auto">
          {selectedSurfaceId ? (() => {
            const surface = scene.surfaces.find((s) => s.id === selectedSurfaceId);
            const source = (scene.sources || []).find((src) => src.id === surface.source_id);
            return (
              <>
                <section>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Properties</h2>
                  <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                    <label className="text-xs text-gray-400 block mb-1">Name</label>
                    <input type="text" value={surface.name} onChange={(e) => {
                      const newScene = migrateScene(scene);
                      newScene.surfaces.find((s) => s.id === selectedSurfaceId).name = e.target.value;
                      handleSceneChange(newScene);
                    }} className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
                  </div>
                </section>

                <section>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Media</h2>
                  <div className="bg-gray-800/50 p-4 rounded-md border border-gray-700/50 flex flex-col gap-3 text-center">
                    {source?.url ? (
                      <div className="text-xs text-gray-300 break-all bg-gray-900 p-2 rounded border border-gray-700 max-h-24 overflow-y-auto">
                        <div className="font-semibold text-emerald-400 mb-1">{source.name}</div>
                        {source.url}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 mb-2">No media assigned</div>
                    )}
                    <label className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded cursor-pointer transition-colors text-sm font-medium border border-gray-600">
                      <Upload size={16} /> Upload & Assign Media
                      <input type="file" className="hidden" onChange={handleMediaUpload} accept="image/*,video/*" />
                    </label>
                  </div>
                </section>
              </>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center px-4">
              <Monitor size={48} className="mb-4 opacity-20" />
              <p>Select a surface to view and edit its properties.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default App;
