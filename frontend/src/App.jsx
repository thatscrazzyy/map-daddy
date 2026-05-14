import React, { useState, useEffect, useRef } from 'react';
import { Upload, Save, Play, Monitor, PlusSquare, Wifi, Link as LinkIcon, Unlink, Copy } from 'lucide-react';

const LOCAL_BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');
const RELAY_URL = import.meta.env.VITE_MAP_DADDY_RELAY_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_RELAY_URL || 'ws://localhost:8080';
const PUBLIC_BACKEND_URL = import.meta.env.VITE_MAP_DADDY_PUBLIC_BACKEND_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_PUBLIC_BACKEND_URL || LOCAL_BACKEND_URL;

function generatePairingCode() {
  return 'MD-' + Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizeSceneMediaUrls(scene, publicBackendUrl) {
  if (!scene) return scene;
  const normalized = JSON.parse(JSON.stringify(scene)); // deep copy
  normalized.sources = normalized.sources || [];
  normalized.sources.forEach(source => {
    if (source.url && source.url.startsWith('/media/')) {
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
  const migrated = JSON.parse(JSON.stringify(scene || {}));
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
  const byUrl = new Map(migrated.sources.filter(s => s.url).map(s => [s.url, s]));
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
  migrated.metadata = migrated.metadata || {
    created_by: 'Map Daddy',
    created_at: '',
    updated_at: ''
  };
  return migrated;
}

function getSceneWidth(scene) {
  return scene?.output?.width || 1920;
}

function getSceneHeight(scene) {
  return scene?.output?.height || 1080;
}

function App() {
  const [scene, setScene] = useState(null);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState(null);
  const [draggingPoint, setDraggingPoint] = useState(null);
  
  const [pairingCode, setPairingCode] = useState(null);
  const [relayStatus, setRelayStatus] = useState('disconnected'); // disconnected, connecting, waiting, connected
  const [rendererStatus, setRendererStatus] = useState('');
  
  const svgRef = useRef(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);

  // Fetch initial local scene
  useEffect(() => {
    fetchScene();
  }, []);

  const fetchScene = async () => {
    try {
      const res = await fetch(`${LOCAL_BACKEND_URL}/api/current-scene`);
      const data = await res.json();
      if (data && data.surfaces) {
        setScene(migrateScene(data));
      }
    } catch (e) {
      console.error("Failed to fetch scene locally", e);
    }
  };

  const saveSceneLocally = async (newScene) => {
    const sceneToSave = migrateScene(newScene || scene);
    try {
      await fetch(`${LOCAL_BACKEND_URL}/api/current-scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sceneToSave)
      });
    } catch (e) {
      console.error("Failed to save scene locally", e);
    }
  };

  const connectToRelay = () => {
    if (wsRef.current) wsRef.current.close();
    
    const code = generatePairingCode();
    setPairingCode(code);
    setRelayStatus('connecting');

    const ws = new WebSocket(RELAY_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', role: 'controller', code }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'joined') {
          setRelayStatus('waiting');
        } else if (msg.type === 'room:status') {
          if (msg.rendererConnected) {
            setRelayStatus('connected');
            if (scene) sendSceneUpdate(scene, ws, code);
          } else {
            setRelayStatus('waiting');
            setRendererStatus('');
          }
        } else if (msg.type === 'renderer:status') {
          setRendererStatus(msg.status);
        } else if (msg.type === 'error') {
          console.error("Relay error:", msg.message);
        }
      } catch (e) {
        console.error("Error parsing WS message", e);
      }
    };

    ws.onclose = () => {
      setRelayStatus('disconnected');
      setRendererStatus('');
    };
  };

  const disconnectRelay = () => {
    if (wsRef.current) wsRef.current.close();
    setPairingCode(null);
  };

  const sendSceneUpdate = (currentScene, ws = wsRef.current, code = pairingCode) => {
    if (ws && ws.readyState === WebSocket.OPEN && code) {
    const publicScene = normalizeSceneMediaUrls(migrateScene(currentScene), PUBLIC_BACKEND_URL);
      ws.send(JSON.stringify({
        type: 'scene:update',
        code: code,
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
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${LOCAL_BACKEND_URL}/api/media/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (selectedSurfaceId && scene) {
        const newScene = migrateScene(scene);
        newScene.sources = [...(newScene.sources || [])];
        const surface = newScene.surfaces.find(s => s.id === selectedSurfaceId);
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
        alert("Select a surface first to assign media!");
      }
    } catch (e) {
      console.error("Upload failed", e);
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
      type: "quad",
      source_id: "",
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
      blend_mode: "normal"
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
    const surface = newScene.surfaces.find(s => s.id === draggingPoint.surfaceId);
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
    if (draggingPoint) {
      setDraggingPoint(null);
    }
  };

  if (!scene) return <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">Loading Local Scene...</div>;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col font-sans">
      <header className="h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900/50 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="text-emerald-500" />
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
            Map Daddy
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          {relayStatus === 'disconnected' ? (
             <button onClick={connectToRelay} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors text-sm font-medium">
               <Wifi size={16} /> Connect Projector (Relay)
             </button>
          ) : (
            <div className="flex items-center gap-3 bg-gray-800 py-1.5 px-3 rounded-md border border-gray-700">
              <div className="flex flex-col">
                <span className="text-xs text-gray-400">Pairing Code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-emerald-400 font-bold">{pairingCode}</span>
                  <button onClick={() => navigator.clipboard.writeText(pairingCode)} className="text-gray-400 hover:text-white" title="Copy Code">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
              <div className="w-px h-8 bg-gray-700 mx-2"></div>
              <div className="flex flex-col min-w-[120px]">
                <span className="text-xs text-gray-400">Status</span>
                <span className="text-sm flex items-center gap-1">
                  {relayStatus === 'waiting' && <><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Waiting for Pi</>}
                  {relayStatus === 'connected' && <><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Pi Connected</>}
                  {relayStatus === 'connecting' && <><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div> Connecting...</>}
                </span>
              </div>
              <button onClick={disconnectRelay} className="p-1.5 hover:bg-gray-700 rounded text-red-400 hover:text-red-300 ml-2" title="Disconnect">
                <Unlink size={16} />
              </button>
            </div>
          )}

          <button onClick={() => saveSceneLocally(scene)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors text-sm font-medium shadow-lg shadow-emerald-900/20">
            <Save size={16} /> Save Local
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        
        <div className="w-64 border-r border-gray-800 bg-gray-900/30 p-4 flex flex-col gap-6 overflow-y-auto">
          <div className="flex-1">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Surfaces</h2>
            <div className="flex flex-col gap-2">
              {scene.surfaces.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSurfaceId(s.id)}
                  className={`text-left px-3 py-2 rounded-md text-sm transition-all ${selectedSurfaceId === s.id ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-gray-800 text-gray-300 border border-transparent'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-800">
            <button onClick={addSurface} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-500 rounded-md transition-colors text-sm font-medium">
              <PlusSquare size={16} /> Add Surface
            </button>
          </div>
        </div>

        <div className="flex-1 bg-black relative flex items-center justify-center p-8 overflow-hidden"
             onPointerMove={handlePointerMove}
             onPointerUp={handlePointerUp}
             onPointerLeave={handlePointerUp}>
          
          {rendererStatus && relayStatus === 'connected' && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-gray-800/80 backdrop-blur border border-gray-700 px-4 py-2 rounded-full text-xs text-gray-300 flex items-center gap-2 pointer-events-none z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              Renderer: {rendererStatus}
            </div>
          )}

          <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-lg shadow-2xl border border-gray-800 overflow-hidden"
               style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '24px 24px' }}>
            
            <svg 
              ref={svgRef}
              viewBox={`0 0 ${getSceneWidth(scene)} ${getSceneHeight(scene)}`} 
              className="absolute inset-0 w-full h-full touch-none"
            >
              {scene.surfaces.map((surface) => {
                const isSelected = surface.id === selectedSurfaceId;
                const pts = surface.destination_points;
                const pathData = `M ${pts[0][0]},${pts[0][1]} L ${pts[1][0]},${pts[1][1]} L ${pts[2][0]},${pts[2][1]} L ${pts[3][0]},${pts[3][1]} Z`;
                
                return (
                  <g key={surface.id} className={!surface.visible ? 'opacity-0' : ''}>
                    <path 
                      d={pathData} 
                      fill={isSelected ? "rgba(16, 185, 129, 0.2)" : "rgba(255,255,255,0.05)"}
                      stroke={isSelected ? "#10b981" : "#4b5563"} 
                      strokeWidth="4"
                      onClick={() => setSelectedSurfaceId(surface.id)}
                      className="cursor-pointer transition-colors hover:stroke-emerald-400"
                    />
                    
                    {isSelected && pts.map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt[0]}
                        cy={pt[1]}
                        r="20"
                        fill="#fff"
                        stroke="#10b981"
                        strokeWidth="4"
                        className="cursor-move hover:r-24 transition-all duration-100"
                        onPointerDown={(e) => handlePointerDown(surface.id, i, e)}
                      />
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="w-80 border-l border-gray-800 bg-gray-900/30 p-4 flex flex-col gap-6 overflow-y-auto">
          {selectedSurfaceId ? (() => {
            const surface = scene.surfaces.find(s => s.id === selectedSurfaceId);
            const source = (scene.sources || []).find(src => src.id === surface.source_id);
            return (
              <>
                <div>
                  <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">Properties</h2>
                  <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                    <label className="text-xs text-gray-400 block mb-1">Name</label>
                    <input 
                      type="text" 
                      value={surface.name} 
                      onChange={(e) => {
                        const newScene = migrateScene(scene);
                        newScene.surfaces.find(s => s.id === selectedSurfaceId).name = e.target.value;
                        handleSceneChange(newScene);
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
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
                      <Upload size={16} />
                      Upload & Assign Media
                      <input type="file" className="hidden" onChange={handleMediaUpload} accept="image/*,video/*" />
                    </label>
                  </div>
                </div>
              </>
            );
          })() : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 text-center px-4">
              <Monitor size={48} className="mb-4 opacity-20" />
              <p>Select a surface to view and edit its properties.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default App;
