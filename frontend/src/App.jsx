import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Bell,
  Box,
  Cable,
  ChevronDown,
  Copy,
  Cpu,
  Edit3,
  Eye,
  EyeOff,
  FolderOpen,
  Grid3X3,
  HelpCircle,
  Hexagon,
  Image,
  Layers,
  LayoutDashboard,
  Library,
  Lock,
  Monitor,
  MousePointer2,
  Network,
  Palette,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  PlusSquare,
  Terminal,
  Trash2,
  Unlock,
  Upload,
  Video,
  Wifi,
  X,
  XCircle,
  Zap,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  AssignSourceCommand,
  ChangeOpacityCommand,
  DeleteMappingCommand,
  DuplicateMappingCommand,
  MoveVertexCommand,
  ReorderMappingCommand,
  ToggleLockCommand,
  ToggleSoloCommand,
  ToggleVisibilityCommand,
  UpdateSceneSnapshotCommand
} from './commands';
import { MappingManager, cloneScene, defaultScene, guessSourceType, migrateScene, outputSize } from './mappingManager';

const DEV_BACKEND_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000');
const BASE_API_URL = import.meta.env.VITE_MAP_DADDY_API_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_API_URL || DEV_BACKEND_URL;
const BASE_RELAY_URL = import.meta.env.VITE_MAP_DADDY_RELAY_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_RELAY_URL || (import.meta.env.PROD ? '' : 'ws://localhost:8080');

const API_URL = localStorage.getItem('md_api_url') || BASE_API_URL;
const RELAY_URL = localStorage.getItem('md_relay_url') || BASE_RELAY_URL;
const PUBLIC_BACKEND_URL = import.meta.env.VITE_MAP_DADDY_PUBLIC_BACKEND_URL || import.meta.env.NEXT_PUBLIC_MAP_DADDY_PUBLIC_BACKEND_URL || API_URL;
const GRID_SIZE = 24;

function httpUrlFromRelay(relayUrl) {
  if (!relayUrl) return '';
  if (relayUrl.startsWith('wss://')) return relayUrl.replace('wss://', 'https://');
  if (relayUrl.startsWith('ws://')) return relayUrl.replace('ws://', 'http://');
  return relayUrl;
}

function normalizeSceneMediaUrls(scene, publicBackendUrl) {
  const normalized = cloneScene(migrateScene(scene));
  normalized.sources.forEach((source) => {
    if (source.url && source.url.startsWith('/media/') && publicBackendUrl) {
      source.url = publicBackendUrl.replace(/\/$/, '') + source.url;
    }
  });
  return normalized;
}

function copyText(value) {
  if (navigator.clipboard && value) navigator.clipboard.writeText(value);
}

function pointsToPath(points) {
  if (!points?.length) return '';
  return `M ${points.map((point) => point.join(',')).join(' L ')} Z`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function svgPoint(svg, event) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const transformed = point.matrixTransform(svg.getScreenCTM().inverse());
  return [Math.round(transformed.x), Math.round(transformed.y)];
}

function editorViewBox(view, width, height) {
  return `${view.panX} ${view.panY} ${width / view.zoom} ${height / view.zoom}`;
}

function IconButton({ children, onClick, title, active = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-8 w-8 items-center justify-center rounded border transition active:scale-95 ${
        active
          ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
          : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ children, tone = 'cyan' }) {
  const tones = {
    cyan: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    magenta: 'border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200',
    lime: 'border-lime-300/30 bg-lime-300/10 text-lime-300',
    red: 'border-red-300/30 bg-red-400/10 text-red-200'
  };
  return <span className={`mono rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

function TopBar({ activePage, relayStatus, rendererConnected, session, startSession, endSession, sessionError, sessionPassword, setSessionPassword, saveStatus }) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 h-12 border-b border-white/10 bg-[#121318]/85 backdrop-blur-xl shadow-[0_0_14px_rgba(0,219,233,0.12)]">
      <div className="flex h-full items-center justify-between pl-[296px] pr-5 max-md:pl-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="neon-cyan text-xl font-black tracking-tight">MAP DADDY v0.3</span>
          {saveStatus && <span className="mono animate-pulse text-[10px] uppercase tracking-widest text-cyan-300">{saveStatus}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 sm:flex">
            <span className={`h-2 w-2 rounded-full ${rendererConnected ? 'bg-lime-300 live-dot' : 'bg-yellow-300'}`} />
            <span className="mono text-xs uppercase tracking-wider text-lime-300">Live Status</span>
          </div>
          {!session ? (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={sessionPassword}
                onChange={(event) => setSessionPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') startSession();
                }}
                minLength={4}
                maxLength={128}
                placeholder="Receiver password"
                className="h-8 w-36 rounded border border-white/10 bg-black/30 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/40 sm:w-44"
              />
              <button onClick={startSession} disabled={relayStatus === 'creating'} className="mono rounded border border-cyan-300/30 bg-cyan-100 px-3 py-1.5 text-xs uppercase tracking-wider text-slate-950 transition hover:bg-cyan-200 disabled:opacity-60">
                {relayStatus === 'creating' ? 'Starting' : 'Start Session'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">
              <button onClick={() => copyText(session.pairingCode)} className="mono text-lime-300">{session.pairingCode}<Copy size={11} className="ml-1 inline" /></button>
              <button onClick={() => copyText(session.sessionSecret)} className="mono text-cyan-200">{session.sessionSecret}<Copy size={11} className="ml-1 inline" /></button>
              <button onClick={endSession} className="text-red-200 hover:text-red-100" title="End session"><XCircle size={16} /></button>
            </div>
          )}
          {sessionError && <span className="hidden max-w-[280px] truncate text-xs text-red-200 xl:inline">{sessionError}</span>}
        </div>
      </div>
    </header>
  );
}

function SideNav({ activePage, setActivePage }) {
  const items = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['workspace', 'Workspace', MousePointer2],
    ['library', 'Library', Library],
    ['settings', 'Settings', Settings]
  ];
  return (
    <nav className="fixed bottom-0 left-0 top-0 z-40 hidden w-[280px] flex-col border-r border-white/10 bg-[#161922]/90 px-3 py-4 backdrop-blur-2xl md:flex">
      <div className="mt-12 flex items-center gap-3 px-3 pb-8 pt-4">
        <div className="flex h-11 w-11 items-center justify-center rounded border border-cyan-300/50 bg-cyan-300/10 text-cyan-100 neon-border">
          <Hexagon size={24} />
        </div>
        <div>
          <div className="neon-cyan text-3xl font-black italic leading-none">DADDY</div>
          <div className="mono mt-1 text-[10px] uppercase tracking-[0.28em] text-slate-400">PRO ENGINE</div>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {items.map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setActivePage(id)}
            className={`flex items-center gap-3 rounded px-4 py-3 text-left transition active:translate-x-1 ${
              activePage === id
                ? 'border-r-2 border-cyan-300 bg-cyan-300/10 text-cyan-100 shadow-[0_0_10px_rgba(0,219,233,0.28)]'
                : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
            }`}
          >
            <Icon size={20} />
            <span className="mono text-xs uppercase tracking-[0.18em]">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

function DashboardPage({ scene, setActivePage, addMapping, startSession }) {
  const mappingCount = scene?.mappings?.length || 0;
  const sourceCount = scene?.sources?.length || 0;
  const projects = [
    ['Facade Session', 'Hosted relay mapping scene', 'LIVE', 'lime', '3D'],
    ['Gallery Loop', 'Multi-output installation', 'SYNCING', 'magenta', '4K'],
    ['Local Backend', 'Receiver test workspace', 'READY', 'cyan', '2D']
  ];
  return (
    <main className="min-h-screen bg-[#0a0b10] pl-[280px] pt-12 max-md:pl-0">
      <div className="grid-bg min-h-[calc(100vh-48px)] p-6">
        <div className="mb-8 grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-black tracking-tight text-slate-100">Project Dashboard</h1>
            <p className="mt-2 text-slate-400">Manage projection workspaces and receiver connectivity.</p>
          </div>
          <div className="glass-panel rounded p-4">
            <div className="flex items-center gap-4">
              <Box className="text-cyan-200" />
              <div><div className="mono text-xs uppercase tracking-wider text-slate-400">Mappings</div><div className="text-3xl font-bold">{mappingCount}</div></div>
            </div>
          </div>
          <div className="glass-panel rounded border-l-2 border-l-lime-300 p-4">
            <div className="flex items-center gap-4">
              <Video className="text-lime-300" />
              <div><div className="mono text-xs uppercase tracking-wider text-slate-400">Sources</div><div className="flex items-center gap-2 text-3xl font-bold">{sourceCount}<span className="h-2 w-2 rounded-full bg-lime-300 live-dot" /></div></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <section className="xl:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="mono flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400"><Grid3X3 size={15} /> Recent Projects</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {projects.map(([title, body, status, tone, tag], index) => (
                <button key={title} onClick={() => setActivePage('workspace')} className="glass-card overflow-hidden rounded text-left transition hover:-translate-y-0.5 hover:border-cyan-300/30">
                  <div className={`${index === 1 ? 'wire-thumb' : 'neon-thumb'} relative h-40`}>
                    <div className="absolute right-3 top-3"><StatusPill tone={tone}>{status}</StatusPill></div>
                  </div>
                  <div className="-mt-8 p-4 pt-10">
                    <h3 className="text-2xl font-bold text-slate-100">{title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{body}</p>
                    <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="mono text-[10px] uppercase tracking-wider text-slate-500">Edited today</span>
                      <StatusPill tone={tag === '4K' ? 'cyan' : 'magenta'}>{tag}</StatusPill>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
          <aside>
            <h2 className="mono mb-4 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400"><Zap size={15} /> Quick Actions</h2>
            <div className="space-y-3">
              <button onClick={() => { addMapping('quad'); setActivePage('workspace'); }} className="flex w-full items-center gap-3 rounded bg-cyan-100 px-4 py-4 text-left text-slate-950 shadow-[0_0_15px_rgba(0,240,255,0.18)]">
                <PlusSquare /><span className="text-xl font-bold">Create Mapping</span>
              </button>
              <button onClick={startSession} className="glass-card flex w-full items-center gap-3 rounded p-4 text-left">
                <Cable className="text-cyan-200" /><div><div className="font-semibold">Connect Receiver</div><div className="mono text-[10px] uppercase text-slate-400">Pairing relay ready</div></div>
              </button>
              <button onClick={() => setActivePage('library')} className="glass-card flex w-full items-center gap-3 rounded p-4 text-left">
                <Upload className="text-slate-300" /><div><div className="font-semibold">Import Assets</div><div className="mono text-[10px] uppercase text-slate-400">Video, images, masks</div></div>
              </button>
              <div className="glass-panel rounded p-4">
                <div className="mb-2 flex justify-between"><span className="mono text-xs uppercase text-slate-400">Local Storage</span><span className="mono text-xs text-cyan-200">42%</span></div>
                <div className="h-1.5 rounded bg-black/50"><div className="h-full w-[42%] rounded bg-gradient-to-r from-cyan-200 to-fuchsia-400" /></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}

function InputCanvas({ scene, selectedMapping, selectedSource, inputShape, selectedVertex, onVertexPointerDown, onBackgroundPointerDown, svgRef, view, isPanning, spacePressed }) {
  const dimensions = selectedSource ? { width: selectedSource.width || 1920, height: selectedSource.height || 1080 } : outputSize(scene);
  const showMedia = selectedSource?.url;
  const gridId = 'input-grid';
  const currentView = view || { zoom: 1, panX: 0, panY: 0 };
  
  return (
    <section className="glass-panel flex min-h-0 flex-1 flex-col rounded">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Media Crop</h2>
          <p className="mono text-[10px] uppercase tracking-wider text-slate-500">{selectedSource?.name || 'No source assigned'}</p>
        </div>
        <div className="mono text-[10px] text-cyan-100">{dimensions.width} x {dimensions.height}</div>
      </div>
      <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-b bg-black">
        {showMedia && (selectedSource.type === 'video'
          ? <video className="absolute inset-0 h-full w-full object-contain opacity-60" src={selectedSource.url} muted loop autoPlay playsInline />
          : <img className="absolute inset-0 h-full w-full object-contain opacity-60" src={selectedSource.url} alt="" />)}
        {!showMedia && <div className="neon-thumb absolute inset-0 opacity-40" />}
        <svg
          ref={svgRef}
          viewBox={editorViewBox(currentView, dimensions.width, dimensions.height)}
          className={`absolute inset-0 h-full w-full touch-none ${
            (spacePressed || isPanning) 
              ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') 
              : 'cursor-grab'
          }`}
          onPointerDown={(event) => onBackgroundPointerDown('input', event)}
        >
          <defs>
            <pattern id={gridId} width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            </pattern>
            <pattern id="lock-stripes" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(0,240,255,0.2)" strokeWidth="4" />
            </pattern>
          </defs>
          <rect data-canvas-background="true" x="0" y="0" width={dimensions.width} height={dimensions.height} fill={`url(#${gridId})`} />
          {inputShape && (
            <g opacity={selectedMapping?.locked ? 0.55 : 1}>
              {selectedMapping?.locked && (
                <path
                  d={pointsToPath(inputShape.vertices)}
                  fill="url(#lock-stripes)"
                />
              )}
              <path
                d={pointsToPath(inputShape.vertices)}
                fill="rgba(0,240,255,0.12)"
                stroke="#7df4ff"
                strokeDasharray={selectedMapping?.locked ? `${12 / currentView.zoom} ${8 / currentView.zoom}` : undefined}
                strokeWidth={4 / currentView.zoom}
              />
              {inputShape.vertices.map((point, index) => {
                const active = selectedVertex?.mode === 'input' && selectedVertex.index === index;
                return (
                  <circle
                    key={index}
                    cx={point[0]}
                    cy={point[1]}
                    r={active ? 17 / currentView.zoom : 13 / currentView.zoom}
                    fill="#0a0b10"
                    stroke={active ? '#e3e1e9' : '#7df4ff'}
                    strokeWidth={4 / currentView.zoom}
                    className={spacePressed ? 'cursor-grab' : (selectedMapping?.locked || inputShape.locked ? 'cursor-not-allowed' : 'cursor-move')}
                    onPointerDown={(event) => onVertexPointerDown('input', index, event)}
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>
    </section>
  );
}

function OutputCanvas({ scene, selectedMapping, selectedMappingId, layerMappings, selectedVertex, onVertexPointerDown, onBackgroundPointerDown, svgRef, view, isPanning, spacePressed }) {
  const dimensions = outputSize(scene);
  const gridId = 'renderer-grid';
  const shapeById = new Map((scene.shapes || []).map((shape) => [shape.id, shape]));
  const visibleMappings = layerMappings.filter((mapping) => mapping.visible !== false);
  const currentView = view || { zoom: 1, panX: 0, panY: 0 };
  
  return (
    <section className="glass-panel flex min-h-0 flex-1 flex-col rounded">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Projector Output</h2>
          <p className="mono text-[10px] uppercase tracking-wider text-slate-500">Physical projection space</p>
        </div>
        <div className="mono text-[10px] text-cyan-100">{dimensions.width} x {dimensions.height}</div>
      </div>
      <div className="relative min-h-[260px] flex-1 overflow-hidden rounded-b bg-black">
        <div className="neon-thumb absolute inset-0 opacity-20" />
        <svg
          ref={svgRef}
          viewBox={editorViewBox(currentView, dimensions.width, dimensions.height)}
          className={`absolute inset-0 h-full w-full touch-none ${
            (spacePressed || isPanning) 
              ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') 
              : 'cursor-grab'
          }`}
          onPointerDown={(event) => onBackgroundPointerDown('output', event)}
        >
          <defs>
            <pattern id={gridId} width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            </pattern>
            <pattern id="lock-stripes" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="12" stroke="rgba(0,240,255,0.15)" strokeWidth="4" />
            </pattern>
          </defs>
          <rect data-canvas-background="true" x="0" y="0" width={dimensions.width} height={dimensions.height} fill={`url(#${gridId})`} />
          <rect x="0" y="0" width={dimensions.width} height={dimensions.height} fill="none" stroke="rgba(125,244,255,0.35)" strokeWidth={2 / currentView.zoom} />
          {visibleMappings.map((mapping) => {
            const shape = shapeById.get(mapping.output_shape_id);
            if (!shape) return null;
            const selected = mapping.id === selectedMappingId;
            return (
              <g key={mapping.id} opacity={mapping.locked ? 0.55 : 1}>
                {mapping.locked && (
                  <path
                    d={pointsToPath(shape.vertices)}
                    fill="url(#lock-stripes)"
                  />
                )}
                <path
                  d={pointsToPath(shape.vertices)}
                  fill={selected ? 'rgba(255,36,228,0.15)' : 'rgba(0,240,255,0.08)'}
                  stroke={selected ? '#ff24e4' : '#7df4ff'}
                  strokeDasharray={mapping.locked ? `${12 / currentView.zoom} ${8 / currentView.zoom}` : undefined}
                  strokeWidth={(selected ? 4 : 2.5) / currentView.zoom}
                />
              </g>
            );
          })}
          {selectedMapping && shapeById.get(selectedMapping.output_shape_id)?.vertices.map((point, index) => {
            const shape = shapeById.get(selectedMapping.output_shape_id);
            const active = selectedVertex?.mode === 'output' && selectedVertex.index === index;
            return (
              <circle
                key={index}
                cx={point[0]}
                cy={point[1]}
                r={active ? 17 / currentView.zoom : 13 / currentView.zoom}
                fill="#0a0b10"
                stroke={active ? '#e3e1e9' : '#ff24e4'}
                strokeWidth={4 / currentView.zoom}
                className={spacePressed ? 'cursor-grab' : (selectedMapping.locked || shape.locked ? 'cursor-not-allowed' : 'cursor-move')}
                onPointerDown={(event) => onVertexPointerDown('output', index, event)}
              />
            );
          })}
        </svg>
      </div>
    </section>
  );
}

function WorkspacePage(props) {
  const {
    scene, selectedMapping, selectedMappingId, setSelectedMappingId, selectedVertex, selectedSource, inputShape,
    layerMappings, snapEnabled, setSnapEnabled, runCommand, addMapping, saveSceneLocally, fitViews, zoomView,      
    handleVertexPointerDown, handleBackgroundPointerDown, inputSvgRef, outputSvgRef, inputView, outputView, handleMediaUpload, dragging,
    spacePressed, confirmAction
  } = props;
  return (
    <main className="flex h-screen bg-[#0a0b10] pl-[280px] pt-12 max-md:pl-0">
      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden grid-bg">
        <div className="flex items-center justify-between border-b border-white/10 bg-[#121318]/80 px-4 py-2 backdrop-blur">
          <div className="text-sm text-slate-400">Project: <strong className="text-slate-100">{scene.project_name}</strong></div>
          <div className="flex items-center gap-2">
            <IconButton onClick={() => addMapping('quad')} title="Add quad" active><Plus size={16} /></IconButton>
            <button onClick={() => addMapping('triangle')} className="mono rounded border border-white/10 px-3 py-1.5 text-xs uppercase text-slate-200 hover:border-cyan-300/40">Triangle</button>
            <button onClick={() => addMapping('mesh')} className="mono rounded border border-white/10 px-3 py-1.5 text-xs uppercase text-slate-200 hover:border-cyan-300/40">Mesh</button>
            <IconButton onClick={() => setSnapEnabled((value) => !value)} active={snapEnabled} title="Toggle grid"><Grid3X3 size={16} /></IconButton>
            <IconButton onClick={fitViews} title="Fit"><Monitor size={16} /></IconButton>
            <IconButton onClick={() => saveSceneLocally(scene)} title="Save"><Save size={16} /></IconButton>
          </div>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-3">
            <div className="glass-panel flex flex-wrap items-center gap-2 rounded px-3 py-2 text-sm">
              <MousePointer2 size={16} className="text-slate-400" />
              <IconButton onClick={() => zoomView('input', 1.2)} title="Zoom media in"><ZoomIn size={15} /></IconButton>
              <IconButton onClick={() => zoomView('input', 0.84)} title="Zoom media out"><ZoomOut size={15} /></IconButton>
              <IconButton onClick={() => zoomView('output', 1.2)} title="Zoom output in"><ZoomIn size={15} /></IconButton>
              <IconButton onClick={() => zoomView('output', 0.84)} title="Zoom output out"><ZoomOut size={15} /></IconButton>
              <span className="mono ml-auto text-[10px] uppercase tracking-wider text-slate-500">Drag empty canvas to pan</span>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
              <InputCanvas scene={scene} selectedMapping={selectedMapping} selectedSource={selectedSource} inputShape={inputShape} selectedVertex={selectedVertex} onVertexPointerDown={handleVertexPointerDown} onBackgroundPointerDown={handleBackgroundPointerDown} svgRef={inputSvgRef} view={inputView} isPanning={dragging?.type === 'pan' && dragging?.mode === 'input'} spacePressed={spacePressed} />
              <OutputCanvas scene={scene} selectedMapping={selectedMapping} selectedMappingId={selectedMappingId} layerMappings={layerMappings} selectedVertex={selectedVertex} onVertexPointerDown={handleVertexPointerDown} onBackgroundPointerDown={handleBackgroundPointerDown} svgRef={outputSvgRef} view={outputView} isPanning={dragging?.type === 'pan' && dragging?.mode === 'output'} spacePressed={spacePressed} />
            </div>
          </div>          <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#161922]/95">
            <section className="flex h-[34%] min-h-[150px] max-h-[300px] shrink-0 flex-col border-b border-white/10">
              <div className="shrink-0 border-b border-white/10 px-4 py-3"><h2 className="mono text-xs uppercase tracking-wider text-slate-200">Layers</h2></div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {layerMappings.map((mapping) => (
                  <button key={mapping.id} onClick={() => setSelectedMappingId(mapping.id)} className={`mb-1 flex w-full items-center gap-2 rounded border p-2 text-left transition ${mapping.locked ? 'opacity-50' : ''} ${selectedMappingId === mapping.id ? 'border-cyan-300/35 bg-cyan-300/10 text-cyan-100 shadow-[0_0_8px_rgba(0,240,255,0.1)]' : 'border-transparent text-slate-300 hover:bg-white/[0.05]'}`}>
                    {mapping.visible === false ? <EyeOff size={16} className="shrink-0" /> : <Eye size={16} className="shrink-0" />}
                    <Layers size={16} className="text-slate-500 shrink-0" />
                    {mapping.solo && <span className="h-2.5 w-2.5 rounded-full bg-lime-300 live-dot mr-1 shrink-0" title="Solo Active" />}
                    <span className="min-w-0 flex-1 truncate text-sm">{mapping.name}</span>
                    {mapping.locked ? <Lock size={15} className="shrink-0" /> : <Unlock size={15} className="shrink-0" />}
                  </button>
                ))}
              </div>
            </section>
            <section className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-white/10 px-4 py-3"><h2 className="mono text-xs uppercase tracking-wider text-slate-200">Properties Inspector</h2></div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {selectedMapping ? (
                <div className="space-y-4">
                  <div>
                    <label className="mono mb-2 block text-[10px] uppercase text-slate-500">Layer Name</label>
                    <input value={selectedMapping.name} onChange={(event) => props.commitScene(new MappingManager(scene).updateMapping(selectedMapping.id, { name: event.target.value }))} className="w-full rounded border border-white/10 bg-black/30 px-2 py-2 text-sm outline-none focus:border-cyan-300/50" />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => runCommand(new ToggleVisibilityCommand(selectedMapping.id))} className="rounded border border-white/10 py-2 text-sm hover:border-cyan-300/40">{selectedMapping.visible === false ? 'Show' : 'Hide'}</button>
                    <button onClick={() => runCommand(new ToggleLockCommand(selectedMapping.id))} className="rounded border border-white/10 py-2 text-sm hover:border-cyan-300/40">{selectedMapping.locked ? 'Unlock' : 'Lock'}</button>
                    <button onClick={() => runCommand(new ToggleSoloCommand(selectedMapping.id))} className={`rounded border py-2 text-sm ${selectedMapping.solo ? 'border-lime-300/50 bg-lime-300/10 text-lime-200' : 'border-white/10 hover:border-cyan-300/40'}`}>Solo</button>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between"><label className="mono text-[10px] uppercase text-slate-500">Opacity</label><span className="mono text-[10px] text-cyan-100">{Math.round((selectedMapping.opacity ?? 1) * 100)}%</span></div>
                    <input type="range" min="0" max="1" step="0.01" value={selectedMapping.opacity ?? 1} onChange={(event) => runCommand(new ChangeOpacityCommand(selectedMapping.id, selectedMapping.opacity ?? 1, Number(event.target.value)))} className="range-cyan w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => runCommand(new ReorderMappingCommand(selectedMapping.id, 1))} className="rounded border border-white/10 py-2 text-sm">Move Up</button>
                    <button onClick={() => runCommand(new ReorderMappingCommand(selectedMapping.id, -1))} className="rounded border border-white/10 py-2 text-sm">Move Down</button>
                    <button onClick={() => runCommand(new DuplicateMappingCommand(selectedMapping.id), true)} className="rounded border border-white/10 py-2 text-sm">Duplicate</button>
                    <button onClick={() => { confirmAction('Delete Layer', 'Are you sure you want to delete this mapping layer?', () => { runCommand(new DeleteMappingCommand(selectedMapping.id)); setSelectedMappingId(null); }); }} className="rounded border border-red-300/25 py-2 text-sm text-red-200">Delete</button>
                  </div>
                  <div>
                    <label className="mono mb-2 block text-[10px] uppercase text-slate-500">Source</label>
                    <select value={selectedMapping.source_id || ''} onChange={(event) => runCommand(new AssignSourceCommand(selectedMapping.id, selectedMapping.source_id, event.target.value))} className="w-full rounded border border-white/10 bg-black/30 px-2 py-2 text-sm outline-none">
                      <option value="">No source</option>
                      {scene.sources.map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
                    </select>
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100 hover:bg-cyan-300/15">
                    <Upload size={16} /> Upload & Assign
                    <input type="file" className="hidden" onChange={handleMediaUpload} accept="image/*,video/*" />
                  </label>
                </div>
              ) : <div className="text-sm text-slate-500">Select or add a mapping.</div>}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

function LibraryPage({ scene, setActivePage, selectedMapping, handleMediaUpload, handleDeleteAsset }) {
  const [query, setQuery] = useState('');
  const assets = scene.sources.length ? scene.sources : [
    { id: 'demo_asset_1', name: 'Quantum_Flux_Loop_V3', type: 'video', width: 3840, height: 2160 },
    { id: 'demo_asset_2', name: 'Wireframe_Topology_Base', type: 'image', width: 1920, height: 1080 },
    { id: 'demo_asset_3', name: 'Particle_Storm_Ambient', type: 'video', width: 7680, height: 4320 }
  ];
  const visibleAssets = assets.filter((asset) => `${asset.name} ${asset.type} ${asset.id}`.toLowerCase().includes(query.toLowerCase()));
  const active = visibleAssets[0] || assets[0];
  return (
    <main className="flex h-screen bg-[#0a0b10] pl-[280px] pt-12 max-md:pl-0">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-end justify-between border-b border-white/10 px-6 py-5">
          <div><h1 className="text-3xl font-black">Asset Library</h1><p className="mt-1 text-slate-400">Manage projections, textures, and receiver-ready media URLs.</p></div>
          <label className="mono flex cursor-pointer items-center gap-2 rounded bg-cyan-100 px-4 py-3 text-xs uppercase tracking-wider text-slate-950">
            <Plus size={17} /> New Asset
            <input type="file" className="hidden" onChange={handleMediaUpload} accept="image/*,video/*" disabled={!selectedMapping} />
          </label>
        </div>
        <div className="border-b border-white/10 bg-[#0d0e13]/70 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[320px] flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded border border-white/10 bg-black/30 py-2 pl-10 pr-10 outline-none focus:border-cyan-300/50" placeholder="Search assets by name, type, or ID..." />
              <SlidersHorizontal size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
          <div className="mt-4 flex gap-6 border-b border-white/10">
            {['Video Loops', 'Textures', '3D Models', 'Presets'].map((tab, index) => <span key={tab} className={`mono pb-2 text-xs uppercase tracking-wider ${index === 0 ? 'border-b-2 border-cyan-200 text-cyan-100' : 'text-slate-400'}`}>{tab}</span>)}
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-6 lg:grid-cols-3 xl:grid-cols-4">
          {visibleAssets.map((asset, index) => (
            <div key={asset.id} className={`glass-card group relative flex h-[220px] flex-col overflow-hidden rounded text-left ${index === 0 ? 'border-cyan-200/80 shadow-[0_0_16px_rgba(0,219,233,0.16)]' : ''}`}>
              <button onClick={() => setActivePage('workspace')} className="absolute inset-0 z-0 text-left cursor-pointer" />
              <div className={`${index === 1 ? 'wire-thumb' : 'neon-thumb'} relative h-[140px] z-10`}>
                <StatusPill tone={asset.type === 'video' ? 'cyan' : 'magenta'}>{asset.type || 'media'}</StatusPill>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAsset(asset);
                  }}
                  className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded bg-black/60 text-red-400 opacity-0 transition group-hover:opacity-100 hover:bg-red-500 hover:text-white cursor-pointer"
                  title="Delete asset"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex flex-1 flex-col p-3 z-10 pointer-events-none">
                <div className="truncate font-semibold text-slate-100">{asset.name}</div>
                <div className="mt-auto flex items-center justify-between"><span className="mono text-[10px] text-slate-500">{asset.width || 1920} x {asset.height || 1080}</span><ChevronDown size={16} className="text-slate-500" /></div>
              </div>
            </div>
          ))}
          {visibleAssets.length === 0 && (
            <div className="col-span-full flex h-48 items-center justify-center rounded border border-white/10 text-sm text-slate-500">No assets match that search.</div>
          )}
        </div>
      </section>
      <aside className="hidden w-[360px] shrink-0 flex-col border-l border-white/10 bg-[#161922]/90 xl:flex">
        <div className="flex items-center justify-between border-b border-white/10 p-4"><span className="mono text-xs uppercase tracking-wider text-slate-300">Asset Details</span><FolderOpen size={17} className="text-slate-400" /></div>
        <div className="space-y-6 p-4">
          <div className="neon-thumb aspect-video rounded border border-white/10" />
          <div><h2 className="break-words text-2xl font-bold">{active.name}</h2><button onClick={() => setActivePage('workspace')} className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-cyan-300/30 bg-cyan-300/10 py-2 text-sm text-cyan-100"><Play size={15} /> Map to Layer</button></div>
          <div className="glass-card rounded p-3">
            {[
              ['Resolution', `${active.width || 3840} x ${active.height || 2160}`],
              ['Codec', active.type === 'video' ? 'H.265 / HEVC' : 'PNG / RGBA'],
              ['Frame Rate', active.type === 'video' ? '120 fps' : 'Static'],
              ['Color Space', 'Rec.709']
            ].map(([label, value]) => <div key={label} className="flex justify-between border-b border-white/10 py-2 last:border-0"><span className="mono text-[10px] uppercase text-slate-500">{label}</span><span>{value}</span></div>)}
          </div>
        </div>
      </aside>
    </main>
  );
}

function OutputSettingsPage({ scene, startSession, saveSceneLocally }) {
  const [localApiUrl, setLocalApiUrl] = useState(() => localStorage.getItem('md_api_url') || '');
  const [localRelayUrl, setLocalRelayUrl] = useState(() => localStorage.getItem('md_relay_url') || '');
  
  const handleSaveOverrides = () => {
    if (localApiUrl.trim()) {
      localStorage.setItem('md_api_url', localApiUrl.trim());
    } else {
      localStorage.removeItem('md_api_url');
    }
    
    if (localRelayUrl.trim()) {
      localStorage.setItem('md_relay_url', localRelayUrl.trim());
    } else {
      localStorage.removeItem('md_relay_url');
    }
    window.location.reload();
  };

  const handleResetOverrides = () => {
    localStorage.removeItem('md_api_url');
    localStorage.removeItem('md_relay_url');
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-[#0a0b10] pl-[280px] pt-12 max-md:pl-0">
      <div className="grid-bg min-h-[calc(100vh-48px)] p-6">
        <div className="mb-6 flex items-end justify-between border-b border-white/10 pb-4">
          <div><h1 className="text-4xl font-black">Output Settings</h1><p className="mono mt-1 text-xs uppercase tracking-[0.22em] text-slate-500">Configure projector arrays and edge blending</p></div>
          <div className="flex gap-3"><button onClick={startSession} className="mono rounded border border-cyan-300/40 px-4 py-2 text-xs uppercase tracking-wider text-cyan-100"><Network size={15} className="mr-2 inline" />Sync Network</button><button onClick={() => saveSceneLocally(scene)} className="mono rounded bg-cyan-100 px-4 py-2 text-xs uppercase tracking-wider text-slate-950"><Save size={15} className="mr-2 inline" />Apply Configuration</button></div>
        </div>
        <div className="grid grid-cols-12 gap-3">
          <section className="glass-panel col-span-12 rounded p-4 lg:col-span-8">
            <div className="mb-4 flex justify-between border-b border-white/10 pb-3"><h2 className="mono text-xs uppercase tracking-wider">Connected Projectors Array</h2><StatusPill tone="lime">Array Online: 1/1</StatusPill></div>
            <table className="w-full text-left text-sm">
              <thead className="mono border-b border-white/10 text-[10px] uppercase text-slate-500"><tr><th className="py-2">ID</th><th>Model</th><th>Address</th><th>Output</th><th className="text-right">Status</th></tr></thead>
              <tbody>
                <tr className="border-b border-white/5"><td className="mono py-4 text-cyan-100">RCV-01</td><td>Map Daddy Receiver</td><td className="mono text-slate-400">Relay Session</td><td>{scene.output.width} x {scene.output.height}</td><td className="text-right"><StatusPill tone="lime">Synced</StatusPill></td></tr>
                <tr><td className="mono py-4 text-cyan-100">PRJ-01</td><td>Projector Output</td><td className="mono text-slate-400">HDMI</td><td>Fullscreen</td><td className="text-right"><StatusPill tone="cyan">Ready</StatusPill></td></tr>
              </tbody>
            </table>
          </section>
          <section className="glass-panel col-span-12 rounded p-4 lg:col-span-4">
            <h2 className="mono mb-4 border-b border-white/10 pb-3 text-xs uppercase tracking-wider">System Load</h2>
            <div className="bg-black/40 p-4"><span className="mono text-[10px] uppercase text-slate-500">Render Output FPS</span><div className="mono mt-1 text-5xl font-bold text-lime-300">59.94</div></div>
            <div className="mt-3 grid grid-cols-2 gap-3"><Metric label="GPU Load" value="84%" tone="cyan" /><Metric label="CPU Load" value="32%" /></div>
          </section>
          
          <section className="glass-panel col-span-12 rounded p-5 lg:col-span-12">
            <h2 className="mono mb-4 border-b border-white/10 pb-3 text-xs uppercase tracking-wider text-slate-200">Advanced Network Overrides (Cloudflare Tunnels)</h2>
            <p className="text-xs text-slate-400 mb-4 font-medium">
              Running a Cloudflare Tunnel for your local setup? Paste your tunnel URLs below to direct this hosted controller (`thatscrazzyy.github.io`) to your local backend and relay.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="mono mb-2 block text-[10px] uppercase text-slate-500">API/Backend Endpoint (HTTPS)</label>
                <input 
                  type="text" 
                  value={localApiUrl} 
                  onChange={(e) => setLocalApiUrl(e.target.value)} 
                  placeholder="https://your-backend-tunnel.trycloudflare.com" 
                  className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50" 
                />
              </div>
              <div>
                <label className="mono mb-2 block text-[10px] uppercase text-slate-500">WebSocket Relay URL (WSS)</label>
                <input 
                  type="text" 
                  value={localRelayUrl} 
                  onChange={(e) => setLocalRelayUrl(e.target.value)} 
                  placeholder="wss://your-relay-tunnel.trycloudflare.com" 
                  className="w-full rounded border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-300/50" 
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button 
                onClick={handleSaveOverrides} 
                className="mono rounded bg-cyan-100 px-4 py-2 text-xs uppercase tracking-wider text-slate-950 font-bold transition hover:bg-cyan-200"
              >
                Apply Overrides & Reload
              </button>
              {(localStorage.getItem('md_api_url') || localStorage.getItem('md_relay_url')) && (
                <button 
                  onClick={handleResetOverrides} 
                  className="mono rounded border border-red-300/30 bg-red-400/10 px-4 py-2 text-xs uppercase tracking-wider text-red-200 transition hover:bg-red-500/20"
                >
                  Reset to Defaults
                </button>
              )}
            </div>
          </section>

          <ConfigCard icon={SlidersHorizontal} title="Edge Blending" body="Manage overlap zones and gamma gradients between adjacent projection fields." tone="cyan" />
          <ConfigCard icon={Grid3X3} title="Geometry & Keystone" body="Launch the warp grid editor for output correction." tone="magenta" />
          <ConfigCard icon={Palette} title="Color Profile Sync" body="Calibrate receiver output against the active projector profile." tone="lime" />
        </div>
      </div>
    </main>
  );
}

function Metric({ label, value, tone = 'slate' }) {
  const color = tone === 'cyan' ? 'bg-cyan-200 text-cyan-100' : 'bg-white/40 text-slate-100';
  return <div className="relative overflow-hidden bg-black/40 p-3"><span className="mono text-[10px] uppercase text-slate-500">{label}</span><div className="mono mt-1 text-xl">{value}</div><div className="absolute bottom-0 left-0 h-1 w-full bg-white/10"><div className={`h-full ${color.split(' ')[0]}`} style={{ width: value }} /></div></div>;
}

function ConfigCard({ icon: Icon, title, body, tone }) {
  const text = tone === 'magenta' ? 'text-fuchsia-300' : tone === 'lime' ? 'text-lime-300' : 'text-cyan-100';
  return <section className="glass-panel col-span-12 rounded p-4 md:col-span-6 lg:col-span-4"><div className="mb-4 flex items-center justify-between"><h2 className="mono flex items-center gap-2 text-xs uppercase tracking-wider"><Icon size={17} className={text} />{title}</h2><span className="h-6 w-11 rounded-full bg-cyan-300/60 p-0.5"><span className="block h-5 w-5 translate-x-5 rounded-full bg-white" /></span></div><p className="text-sm text-slate-400">{body}</p></section>;
}

function App() {
  const [scene, setScene] = useState(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [selectedMappingId, setSelectedMappingId] = useState(null);
  const [selectedVertex, setSelectedVertex] = useState(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [inputView, setInputView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [outputView, setOutputView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [dragging, setDragging] = useState(null);
  const [session, setSession] = useState(null);
  const [relayStatus, setRelayStatus] = useState('idle');
  const [rendererConnected, setRendererConnected] = useState(false);
  const [rendererStatus, setRendererStatus] = useState('');
  const [sessionPassword, setSessionPassword] = useState(import.meta.env.VITE_MAP_DADDY_SESSION_SECRET || '');
  const [sessionError, setSessionError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  
  const [toast, setToast] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [spacePressed, setSpacePressed] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  };

  const confirmAction = (title, message, onConfirm) => {
    setConfirmDialog({ title, message, onConfirm });
  };

  const inputSvgRef = useRef(null);
  const outputSvgRef = useRef(null);
  const wsRef = useRef(null);
  const debounceRef = useRef(null);
  const reconnectRef = useRef(null);
  const joinedRef = useRef(false);
  const sessionRef = useRef(null);
  const sceneRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);
  const dragStartRef = useRef(null);

  const manager = useMemo(() => scene ? new MappingManager(scene) : null, [scene]);
  const layerMappings = manager?.layerMappings() || [];
  const selectedMapping = manager?.getMapping(selectedMappingId) || layerMappings[0] || null;
  const selectedSource = selectedMapping ? manager?.getSource(selectedMapping.source_id) : null;
  const inputShape = selectedMapping ? manager?.getShape(selectedMapping.input_shape_id) : null;
  const outputShape = selectedMapping ? manager?.getShape(selectedMapping.output_shape_id) : null;

  useEffect(() => {
    fetchScene();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => { sceneRef.current = scene; }, [scene]);

  useEffect(() => {
    if (scene && !selectedMappingId) setSelectedMappingId((new MappingManager(scene).layerMappings()[0] || {}).id || null);
  }, [scene, selectedMappingId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const currentScene = sceneRef.current;
      if (!currentScene || activePage !== 'workspace') return;
      
      if (event.code === 'Space') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT' && document.activeElement.tagName !== 'TEXTAREA') {
          event.preventDefault();
          setSpacePressed(true);
          return;
        }
      }

      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z' && event.shiftKey) { event.preventDefault(); redo(); return; }
      if (meta && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); return; }
      if (meta && event.key.toLowerCase() === 'd') { event.preventDefault(); if (selectedMappingId) runCommand(new DuplicateMappingCommand(selectedMappingId), true); return; }
      if (event.key === 'Delete' && selectedMappingId) {
        event.preventDefault();
        confirmAction(
          'Delete Layer',
          'Are you sure you want to delete this mapping layer?',
          () => {
            runCommand(new DeleteMappingCommand(selectedMappingId));
            setSelectedMappingId(null);
          }
        );
        return;
      }
      if (event.key.toLowerCase() === 'f') { event.preventDefault(); fitViews(); return; }
      if (event.key.toLowerCase() === 'g') { event.preventDefault(); setSnapEnabled((value) => !value); return; }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) && selectedVertex && selectedMapping) {
        event.preventDefault();
        const delta = event.shiftKey ? 10 : 1;
        const direction = { ArrowUp: [0, -delta], ArrowDown: [0, delta], ArrowLeft: [-delta, 0], ArrowRight: [delta, 0] }[event.key];
        const shape = selectedVertex.mode === 'input' ? inputShape : outputShape;
        if (!shape || selectedMapping.locked || shape.locked) return;
        const from = shape.vertices[selectedVertex.index];
        runCommand(new MoveVertexCommand(shape.id, selectedVertex.index, from, [from[0] + direction[0], from[1] + direction[1]]));
      }
    };

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        setSpacePressed(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [activePage, selectedMappingId, selectedVertex, selectedMapping, inputShape, outputShape]);

  const fetchScene = async () => {
    if (!API_URL) { setScene(defaultScene()); return; }
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/current-scene`);
      const data = await res.json();
      setScene(data ? migrateScene(data) : defaultScene());
    } catch (e) {
      console.error('Failed to fetch scene, using demo scene', e);
      setScene(defaultScene());
    }
  };

  const saveSceneLocally = async (newScene) => {
    if (!API_URL) { setSessionError('No API URL configured for saving scenes.'); return; }
    const sceneToSave = migrateScene(newScene || sceneRef.current);
    try {
      setSaveStatus('Saving...');
      await fetch(`${API_URL.replace(/\/$/, '')}/api/current-scene`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sceneToSave) });
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (e) {
      console.error('Failed to save scene', e);
      setSaveStatus('Save Error');
      setTimeout(() => setSaveStatus(''), 3000);
      setSessionError('Could not save scene to the backend.');
    }
  };

  const createSession = async (password = '') => {
    const apiBase = (API_URL || httpUrlFromRelay(RELAY_URL)).replace(/\/$/, '');
    const endpoints = [`${apiBase}/api/sessions/create`, `${httpUrlFromRelay(RELAY_URL).replace(/\/$/, '')}/sessions`];
    const trimmedPassword = password.trim();
    const body = trimmedPassword ? JSON.stringify({ session_secret: trimmedPassword }) : '{}';
    let lastError = null;
    for (const endpoint of endpoints) {
      if (!endpoint || endpoint === '/api/sessions/create') continue;
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (res.ok) return res.json();
        lastError = new Error(`${endpoint} returned ${res.status}`);
      } catch (e) { lastError = e; }
    }
    throw lastError || new Error('Session endpoint is not configured.');
  };

  const startSession = async () => {
    setSessionError('');
    const trimmedPassword = sessionPassword.trim();
    if (trimmedPassword && (trimmedPassword.length < 4 || trimmedPassword.length > 128)) {
      setSessionError('Password must be 4 to 128 characters.');
      return;
    }
    setRelayStatus('creating');
    setRendererConnected(false);
    try {
      const created = await createSession(trimmedPassword);
      const nextSession = { relayUrl: created.relay_url || RELAY_URL, pairingCode: created.pairing_code, sessionSecret: created.session_secret, expiresAt: created.expires_at };
      setSession(nextSession);
      setSessionPassword('');
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
    ws.onopen = () => ws.send(JSON.stringify({ type: 'join', role: 'controller', code: activeSession.pairingCode, sessionSecret: activeSession.sessionSecret }));
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'joined') {
          joinedRef.current = true;
          setRelayStatus('waiting');
          if (sceneRef.current) sendSceneUpdate(sceneRef.current, ws, activeSession);
        } else if (msg.type === 'room:status') {
          setRendererConnected(!!msg.rendererConnected);
          setRelayStatus(msg.rendererConnected ? 'connected' : 'waiting');
          if (msg.rendererConnected && sceneRef.current) sendSceneUpdate(sceneRef.current, ws, activeSession);
        } else if (msg.type === 'renderer:status') {
          setRendererStatus(msg.status);
        } else if (msg.type === 'error') {
          setSessionError(msg.message || 'Relay error');
          setRelayStatus('error');
        }
      } catch (e) { console.error('Error parsing WS message', e); }
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
    ws.onerror = () => setSessionError('WebSocket connection failed.');
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
      ws.send(JSON.stringify({ type: 'scene:update', code: activeSession.pairingCode, sessionSecret: activeSession.sessionSecret, scene: normalizeSceneMediaUrls(currentScene, PUBLIC_BACKEND_URL) }));
    }
  };

  const commitScene = (newScene) => {
    const migratedScene = migrateScene(newScene);
    setScene(migratedScene);
    sceneRef.current = migratedScene;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveSceneLocally(migratedScene);
      sendSceneUpdate(migratedScene);
    }, 120);
  };

  const runCommand = (command, selectNew = false) => {
    const before = sceneRef.current || defaultScene();
    const after = command.execute(before);
    undoRef.current.push(command);
    redoRef.current = [];
    commitScene(after);
    if (selectNew) {
      const beforeIds = new Set((before.mappings || []).map((mapping) => mapping.id));
      const added = after.mappings.find((mapping) => !beforeIds.has(mapping.id));
      if (added) setSelectedMappingId(added.id);
    }
  };

  const undo = () => {
    const command = undoRef.current.pop();
    if (!command) return;
    redoRef.current.push(command);
    commitScene(command.undo(sceneRef.current));
  };

  const redo = () => {
    const command = redoRef.current.pop();
    if (!command) return;
    undoRef.current.push(command);
    commitScene(command.execute(sceneRef.current));
  };

  const fitViews = () => {
    setInputView({ zoom: 1, panX: 0, panY: 0 });
    setOutputView({ zoom: 1, panX: 0, panY: 0 });
  };

  const zoomView = (mode, factor) => {
    const setter = mode === 'input' ? setInputView : setOutputView;
    setter((view) => ({ ...view, zoom: clamp(view.zoom * factor, 0.25, 8) }));
  };
  const snapPoint = (mode, shapeId, point) => {
    if (!snapEnabled || !sceneRef.current) return point;
    const dimensions = mode === 'input' && selectedSource ? { width: selectedSource.width || 1920, height: selectedSource.height || 1080 } : outputSize(sceneRef.current);
    let snapped = [clamp(Math.round(point[0] / GRID_SIZE) * GRID_SIZE, 0, dimensions.width), clamp(Math.round(point[1] / GRID_SIZE) * GRID_SIZE, 0, dimensions.height)];
    for (const shape of sceneRef.current.shapes || []) {
      if (shape.id === shapeId) continue;
      for (const vertex of shape.vertices || []) {
        if (Math.abs(vertex[0] - point[0]) <= GRID_SIZE && Math.abs(vertex[1] - point[1]) <= GRID_SIZE) {
          snapped = [vertex[0], vertex[1]];
        }
      }
    }
    return snapped;
  };

  const handleVertexPointerDown = (mode, index, event) => {
    event.stopPropagation();
    if (spacePressed) {
      handleBackgroundPointerDown(mode, event);
      return;
    }
    if (!selectedMapping) return;
    const shape = mode === 'input' ? inputShape : outputShape;
    if (!shape || selectedMapping.locked || shape.locked) return;
    setSelectedVertex({ mode, index });
    dragStartRef.current = { mode, shapeId: shape.id, index, from: shape.vertices[index] };
    setDragging({ mode, shapeId: shape.id, index });
  };

  const handleBackgroundPointerDown = (mode, event) => {
    if (event.button !== 0 && event.button !== 1) return;
    const isMiddleClick = event.button === 1;
    const isSpaceDrag = spacePressed;
    if (isMiddleClick || isSpaceDrag || event.target.tagName === 'svg' || event.target.dataset.canvasBackground === 'true') {
      setSelectedVertex(null);
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const view = mode === 'input' ? inputView : outputView;
      setDragging({ type: 'pan', mode, startX: event.clientX, startY: event.clientY, view });
    }
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    if (dragging.type === 'pan') {
      const svg = dragging.mode === 'input' ? inputSvgRef.current : outputSvgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const dimensions = dragging.mode === 'input' && selectedSource ? { width: selectedSource.width || 1920, height: selectedSource.height || 1080 } : outputSize(sceneRef.current);
      const scaleX = (dimensions.width / dragging.view.zoom) / Math.max(rect.width, 1);
      const scaleY = (dimensions.height / dragging.view.zoom) / Math.max(rect.height, 1);
      const setter = dragging.mode === 'input' ? setInputView : setOutputView;
      setter({
        ...dragging.view,
        panX: dragging.view.panX - ((event.clientX - dragging.startX) * scaleX),
        panY: dragging.view.panY - ((event.clientY - dragging.startY) * scaleY)
      });
      return;
    }
    const svg = dragging.mode === 'input' ? inputSvgRef.current : outputSvgRef.current;
    if (!svg) return;
    const point = snapPoint(dragging.mode, dragging.shapeId, svgPoint(svg, event));
    const next = new MappingManager(sceneRef.current).updateShapeVertex(dragging.shapeId, dragging.index, point);
    setScene(next);
    sceneRef.current = next;
  };

  const handlePointerUp = () => {
    if (!dragging || !dragStartRef.current) { setDragging(null); return; }
    const currentShape = sceneRef.current.shapes.find((shape) => shape.id === dragStartRef.current.shapeId);
    const to = currentShape?.vertices?.[dragStartRef.current.index];
    const from = dragStartRef.current.from;
    if (to && (to[0] !== from[0] || to[1] !== from[1])) {
      undoRef.current.push(new MoveVertexCommand(dragStartRef.current.shapeId, dragStartRef.current.index, from, to));
      redoRef.current = [];
      commitScene(sceneRef.current);
    }
    dragStartRef.current = null;
    setDragging(null);
  };

  const addMapping = (type) => {
    const command = new UpdateSceneSnapshotCommand(`Add ${type}`, sceneRef.current, new MappingManager(sceneRef.current).addMapping(type, selectedSource?.id || ''));
    runCommand(command, true);
  };

  const handleDeleteAsset = (asset) => {
    confirmAction(
      'Delete Asset',
      `Are you sure you want to delete "${asset.name}" from local storage? This will remove it from all mappings using this source.`,
      async () => {
        try {
          let filename = asset.id;
          if (asset.url && asset.url.includes('/media/')) {
            filename = asset.url.split('/media/')[1];
          }
          if (API_URL) {
            await fetch(`${API_URL.replace(/\/$/, '')}/api/media/${filename}`, { method: 'DELETE' });
          }
          const before = sceneRef.current;
          const next = cloneScene(before);
          next.sources = next.sources.filter((s) => s.id !== asset.id);
          next.mappings = next.mappings.map((mapping) => {
            if (mapping.source_id === asset.id) {
              return { ...mapping, source_id: '' };
            }
            return mapping;
          });
          commitScene(next);
          showToast('Asset deleted successfully!', 'success');
        } catch (e) {
          console.error('Failed to delete asset', e);
          showToast('Failed to delete asset.', 'error');
        }
      }
    );
  };

  const handleMediaUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !API_URL || !selectedMapping) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL.replace(/\/$/, '')}/api/media/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      const before = sceneRef.current;
      const next = cloneScene(before);
      const sourceId = `source_${Date.now()}`;
      const dims = outputSize(next);
      next.sources.push({ id: sourceId, name: file.name, type: guessSourceType(data.url, file.type), url: data.url, width: dims.width, height: dims.height, loop: true, muted: true });
      const mapping = next.mappings.find((item) => item.id === selectedMapping.id);
      if (mapping) mapping.source_id = sourceId;
      runCommand(new UpdateSceneSnapshotCommand('Upload source', before, next));
      showToast('Media uploaded and assigned!', 'success');
    } catch (e) {
      console.error('Upload failed', e);
      showToast('Media upload failed.', 'error');
      setSessionError('Media upload failed.');
    } finally {
      event.target.value = '';
    }
  };

  if (!scene) return <div className="flex min-h-screen items-center justify-center bg-[#0a0b10] text-slate-100">Loading Map Daddy...</div>;

  const workspaceProps = {
    scene, selectedMapping, selectedMappingId, setSelectedMappingId, selectedSource, inputShape, outputShape, selectedVertex,
    layerMappings, snapEnabled, setSnapEnabled, runCommand, addMapping, saveSceneLocally, fitViews, zoomView,
    handleVertexPointerDown, handleBackgroundPointerDown, inputSvgRef, outputSvgRef, inputView, outputView, handleMediaUpload, commitScene, dragging,
    spacePressed, confirmAction
  };

  return (
    <div className="min-h-screen bg-[#0a0b10] text-slate-100" onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerLeave={handlePointerUp}>
      <div className="fixed left-0 right-0 top-0 z-[60] h-0.5 bg-gradient-to-r from-transparent via-lime-300 to-transparent opacity-80" />
      <TopBar activePage={activePage} relayStatus={relayStatus} rendererConnected={rendererConnected} session={session} startSession={startSession} endSession={endSession} sessionError={sessionError || rendererStatus} sessionPassword={sessionPassword} setSessionPassword={setSessionPassword} saveStatus={saveStatus} />
      <SideNav activePage={activePage} setActivePage={setActivePage} />
      {activePage === 'dashboard' && <DashboardPage scene={scene} setActivePage={setActivePage} addMapping={addMapping} startSession={startSession} />}
      {activePage === 'workspace' && <WorkspacePage {...workspaceProps} />}
      {activePage === 'library' && <LibraryPage scene={scene} setActivePage={setActivePage} selectedMapping={selectedMapping} handleMediaUpload={handleMediaUpload} handleDeleteAsset={handleDeleteAsset} />}
      {activePage === 'settings' && <OutputSettingsPage scene={scene} startSession={startSession} saveSceneLocally={saveSceneLocally} />}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] flex toast-slide-in items-center gap-3 rounded-lg border border-cyan-300/35 bg-[#121318]/90 px-4 py-3 text-sm text-cyan-100 shadow-[0_0_20px_rgba(0,240,255,0.25)] backdrop-blur-xl">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-300/20 text-cyan-300 font-bold text-xs">✓</span>
          <span className="mono uppercase tracking-wider text-xs">{toast.message}</span>
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm toast-slide-in rounded-lg border-t-4 border-t-cyan-300 p-6 shadow-[0_0_30px_rgba(0,240,255,0.15)]">
            <h3 className="text-lg font-bold text-slate-100">{confirmDialog.title}</h3>
            <p className="mt-3 text-sm text-slate-400">{confirmDialog.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="mono rounded border border-white/10 bg-white/[0.02] px-4 py-2 text-xs uppercase tracking-wider text-slate-300 hover:bg-white/[0.08]"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="mono rounded bg-cyan-100 px-4 py-2 text-xs uppercase tracking-wider text-slate-950 hover:bg-cyan-200"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
