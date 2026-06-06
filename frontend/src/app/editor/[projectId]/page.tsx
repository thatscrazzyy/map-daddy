import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Grid3x3,
  Home,
  Image as ImageIcon,
  Layers,
  Magnet,
  MousePointer2,
  Move,
  Redo2,
  Settings,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { CalibrationPanel } from '../../../components/editor/CalibrationPanel';
import { EditorCanvas } from '../../../components/editor/EditorCanvas';
import { FirstRunChecklist } from '../../../components/editor/FirstRunChecklist';
import { MediaPanel } from '../../../components/editor/MediaPanel';
import { ProjectorStatus } from '../../../components/editor/ProjectorStatus';
import { SurfaceControls } from '../../../components/editor/SurfaceControls';
import { seamAlignedBearing } from '../../../layers/skyProjection';
import { createDefaultSurface, normalizeCalibration } from '../../../lib/projects/defaultProject';
import { getProject, releaseProjectMediaObjectUrls, saveProject, uploadMedia } from '../../../lib/projects/projectRepository';
import { generateSampleImage } from '../../../lib/projects/sampleMedia';
import {
  centerSurfaceOnCanvas,
  duplicateSurface,
  fitSurfaceToCanvas,
  moveSurfaceBackward,
  moveSurfaceForward,
  resetSurfaceRectangle,
  snapSurfaceToGrid
} from '../../../lib/projects/surfaceOperations';
import type { MappingSurface, ProjectMedia, ProjectState, SurfaceCalibration } from '../../../lib/projects/types';
import { ProjectRealtimeClient } from '../../../lib/realtime/realtimeClient';
import { appPath } from '../../../lib/routing';
import { APP_VERSION_LABEL } from '../../../lib/version';

function mediaDimensions(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => { URL.revokeObjectURL(objectUrl); resolve({ width: video.videoWidth || 1920, height: video.videoHeight || 1080 }); };
      video.onerror = () => { URL.revokeObjectURL(objectUrl); resolve({ width: 1920, height: 1080 }); };
      video.src = objectUrl;
    });
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve({ width: image.naturalWidth || 1, height: image.naturalHeight || 1 }); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not read image dimensions')); };
    image.src = objectUrl;
  });
}

function surfaceSizedToMedia(project: ProjectState, surface: MappingSurface, mediaId: string, dimensions: { width: number; height: number }) {
  const maxWidth = project.canvas.width * 0.8;
  const maxHeight = project.canvas.height * 0.8;
  const scale = Math.min(1, maxWidth / dimensions.width, maxHeight / dimensions.height);
  const width = Math.max(1, Math.round(dimensions.width * scale));
  const height = Math.max(1, Math.round(dimensions.height * scale));
  const left = Math.round((project.canvas.width - width) / 2);
  const top = Math.round((project.canvas.height - height) / 2);

  return {
    ...surface,
    mediaId,
    sourceRect: {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height
    },
    destinationQuad: [
      { x: left, y: top },
      { x: left + width, y: top },
      { x: left + width, y: top + height },
      { x: left, y: top + height }
    ] as MappingSurface['destinationQuad']
  };
}

export function EditorPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState('');
  const [syncStatus, setSyncStatus] = useState('connecting');
  const [projectorCount, setProjectorCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [mediaNotice, setMediaNotice] = useState('');
  const [copiedProjectorLink, setCopiedProjectorLink] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [calibratingSurfaceId, setCalibratingSurfaceId] = useState('');
  const [showGrid, setShowGrid] = useState(false);
  const realtimeRef = useRef<ProjectRealtimeClient | null>(null);
  const saveTimerRef = useRef(0);
  const historyRef = useRef<ProjectState[]>([]);
  const redoRef = useRef<ProjectState[]>([]);
  const projectRef = useRef<ProjectState | null>(null);
  projectRef.current = project;

  useEffect(() => {
    let active = true;
    getProject(projectId).then((loaded) => {
      if (!active) return;
      setProject(loaded);
      setSelectedSurfaceId(loaded.surfaces[0]?.id || '');
      const client = new ProjectRealtimeClient(projectId, 'editor', {
        onStatus: setSyncStatus,
        onPresence: (presence) => setProjectorCount(presence.projectorCount),
        onError: () => setSyncStatus('local')
      });
      realtimeRef.current = client;
      client.connect();
      client.sendProject(loaded, true);
    });
    return () => {
      active = false;
      window.clearTimeout(saveTimerRef.current);
      realtimeRef.current?.disconnect();
      releaseProjectMediaObjectUrls(projectRef.current);
    };
  }, [projectId]);

  const projectorPath = useMemo(() => appPath(`/projector/${projectId}`), [projectId]);
  const projectorUrl = useMemo(() => `${window.location.origin}${projectorPath}`, [projectorPath]);

  const copyProjectorLink = async () => {
    await navigator.clipboard.writeText(projectorPath);
    setCopiedProjectorLink(true);
    window.setTimeout(() => setCopiedProjectorLink(false), 1400);
  };

  const applyHistoryState = (state: ProjectState) => {
    setProject(state);
    realtimeRef.current?.sendProject(state);
    window.clearTimeout(saveTimerRef.current);
    setIsDirty(true);
    saveTimerRef.current = window.setTimeout(() => {
      saveProject(state).then(() => {
        setIsDirty(false);
      });
    }, 450);
  };

  const commitProject = (updater: (project: ProjectState) => ProjectState) => {
    setProject((current) => {
      if (!current) return current;
      historyRef.current = [...historyRef.current.slice(-49), current];
      redoRef.current = [];
      const next = { ...updater(current), updatedAt: new Date().toISOString() };
      realtimeRef.current?.sendProject(next);
      window.clearTimeout(saveTimerRef.current);
      setIsDirty(true);
      saveTimerRef.current = window.setTimeout(() => {
        saveProject(next).then(() => {
          setIsDirty(false);
        });
      }, 450);
      return next;
    });
  };

  const undoProject = () => {
    const prev = historyRef.current[historyRef.current.length - 1];
    if (!prev) return;
    const current = projectRef.current;
    if (current) redoRef.current = [...redoRef.current.slice(-49), current];
    historyRef.current = historyRef.current.slice(0, -1);
    applyHistoryState(prev);
  };

  const redoProject = () => {
    const next = redoRef.current[redoRef.current.length - 1];
    if (!next) return;
    const current = projectRef.current;
    if (current) historyRef.current = [...historyRef.current.slice(-49), current];
    redoRef.current = redoRef.current.slice(0, -1);
    applyHistoryState(next);
  };

  const patchSurface = (surfaceId: string, patch: Partial<MappingSurface>) => {
    commitProject((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => surface.id === surfaceId ? { ...surface, ...patch } : surface)
    }));
  };

  const patchMedia = (mediaId: string, patch: Partial<ProjectMedia>) => {
    commitProject((current) => ({
      ...current,
      media: current.media.map((item) => item.id === mediaId ? { ...item, ...patch } : item)
    }));
  };

  const setSurfaceCalibration = (surfaceId: string, calibration: SurfaceCalibration) => {
    patchSurface(surfaceId, { calibration: normalizeCalibration(calibration) });
  };

  const flashReferenceStar = (surfaceId: string, starName: string) => {
    // 3-second amber flash; skyScene auto-stops at `until`, no clear-timer needed.
    patchSurface(surfaceId, { flashTarget: { name: starName, until: Date.now() + 3000 } });
  };

  const alignSeam = (surfaceId: string) => {
    const current = projectRef.current;
    if (!current) return;
    const surfaceB = current.surfaces.find((surface) => surface.id === surfaceId);
    if (!surfaceB || surfaceB.contentType !== 'live') return;
    const surfaceA = current.surfaces.find(
      (surface) => surface.id !== surfaceId && surface.contentType === 'live' && surface.liveLayerId === surfaceB.liveLayerId
    );
    if (!surfaceA) return;
    const a = normalizeCalibration(surfaceA.calibration);
    const b = normalizeCalibration(surfaceB.calibration);
    setSurfaceCalibration(surfaceId, { ...b, wallBearingDeg: seamAlignedBearing(a.wallBearingDeg, a.fovDeg) });
  };

  const addSurface = () => {
    if (!project) return;
    const surface = createDefaultSurface(project, project.media[0]?.id || '');
    setSelectedSurfaceId(surface.id);
    commitProject((current) => ({ ...current, surfaces: [...current.surfaces, surface] }));
  };

  const deleteSurface = (surfaceId: string) => {
    commitProject((current) => {
      const surfaces = current.surfaces.filter((surface) => surface.id !== surfaceId);
      setSelectedSurfaceId(surfaces[0]?.id || '');
      return { ...current, surfaces };
    });
  };

  const moveCorner = (surfaceId: string, cornerIndex: number, point: { x: number; y: number }) => {
    commitProject((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => {
        if (surface.id !== surfaceId) return surface;
        const quad = [...surface.destinationQuad] as MappingSurface['destinationQuad'];
        quad[cornerIndex] = point;
        return { ...surface, destinationQuad: quad };
      })
    }));
  };

  const moveSurface = (surfaceId: string, quad: MappingSurface['destinationQuad']) => {
    commitProject((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => surface.id === surfaceId ? { ...surface, destinationQuad: quad } : surface)
    }));
  };

  const updateSurface = (surfaceId: string, updater: (surface: MappingSurface, current: ProjectState) => MappingSurface) => {
    commitProject((current) => ({
      ...current,
      surfaces: current.surfaces.map((surface) => surface.id === surfaceId ? updater(surface, current) : surface)
    }));
  };

  const centerSurface = (surfaceId: string) => {
    updateSurface(surfaceId, (surface, current) => centerSurfaceOnCanvas(surface, current.canvas));
  };

  const fitSurface = (surfaceId: string) => {
    updateSurface(surfaceId, (surface, current) => fitSurfaceToCanvas(surface, current.canvas));
  };

  const resetSurface = (surfaceId: string) => {
    updateSurface(surfaceId, (surface, current) => resetSurfaceRectangle(surface, current.canvas));
  };

  const snapSurface = (surfaceId: string) => {
    updateSurface(surfaceId, (surface) => snapSurfaceToGrid(surface));
  };

  const duplicateSelectedSurface = (surfaceId: string) => {
    commitProject((current) => {
      const selected = current.surfaces.find((surface) => surface.id === surfaceId);
      if (!selected) return current;

      const duplicate = duplicateSurface(selected, current.surfaces, current.canvas);
      setSelectedSurfaceId(duplicate.id);
      const selectedIndex = current.surfaces.findIndex((surface) => surface.id === surfaceId);
      const surfaces = [...current.surfaces];
      surfaces.splice(selectedIndex + 1, 0, duplicate);
      return { ...current, surfaces };
    });
  };

  const bringSurfaceForward = (surfaceId: string) => {
    commitProject((current) => ({ ...current, surfaces: moveSurfaceForward(current.surfaces, surfaceId) }));
  };

  const sendSurfaceBackward = (surfaceId: string) => {
    commitProject((current) => ({ ...current, surfaces: moveSurfaceBackward(current.surfaces, surfaceId) }));
  };

  const handleUpload = async (file: File) => {
    setMediaNotice('');
    const dimensions = await mediaDimensions(file);
    const media = await uploadMedia(file, { onSessionOnlyMedia: setMediaNotice });
    commitProject((current) => {
      const selected = current.surfaces.find((surface) => surface.id === selectedSurfaceId);
      if (!selected) {
        const surface = surfaceSizedToMedia(current, createDefaultSurface(current, media.id), media.id, dimensions);
        setSelectedSurfaceId(surface.id);
        return { ...current, media: [...current.media, media], surfaces: [...current.surfaces, surface] };
      }

      const surfaces = current.surfaces.map((surface) => (
        surface.id === selectedSurfaceId ? surfaceSizedToMedia(current, surface, media.id, dimensions) : surface
      ));
      return { ...current, media: [...current.media, media], surfaces };
    });
  };

  const handleAddSample = async () => {
    const file = await generateSampleImage();
    await handleUpload(file);
  };

  const go = (path: string) => {
    window.history.pushState({}, '', appPath(path));
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  // Keep a stable ref to the latest callbacks/state for the keyboard handler
  const keybindRef = useRef({ commitProject, undoProject, redoProject, selectedSurfaceId });
  keybindRef.current = { commitProject, undoProject, redoProject, selectedSurfaceId };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isInput = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement;
      if (isInput) return;

      const { commitProject, undoProject, redoProject, selectedSurfaceId } = keybindRef.current;

      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) { event.preventDefault(); undoProject(); return; }
        if (event.key === 'y' || (event.key === 'z' && event.shiftKey)) { event.preventDefault(); redoProject(); return; }
        return;
      }

      const step = event.shiftKey ? 10 : 1;
      const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
      const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
      if (!dx && !dy) return;

      event.preventDefault();
      if (!selectedSurfaceId) return;

      commitProject((current) => ({
        ...current,
        surfaces: current.surfaces.map((surface) => {
          if (surface.id !== selectedSurfaceId) return surface;
          return {
            ...surface,
            destinationQuad: surface.destinationQuad.map((pt) => ({
              x: Math.max(0, Math.min(current.canvas.width, pt.x + dx)),
              y: Math.max(0, Math.min(current.canvas.height, pt.y + dy))
            })) as MappingSurface['destinationQuad']
          };
        })
      }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!project) return <div className="flex min-h-screen items-center justify-center bg-[#080807] text-[#c8b89a]">Loading project...</div>;

  const calibratingSurface = calibratingSurfaceId
    ? project.surfaces.find((surface) => surface.id === calibratingSurfaceId && surface.contentType === 'live') ?? null
    : null;

  return (
    <main className="flex h-screen min-w-[980px] flex-col bg-[#080807] text-[#c8b89a]">
      <header className="grid h-[42px] grid-cols-[minmax(240px,1fr)_auto_minmax(360px,1fr)] items-center border-b border-[#111009] bg-[#0c0c0a] px-2">
        <div className="flex min-w-0 items-center gap-2">
          <button className="md-button h-8 w-8" onClick={() => go('/dashboard')} title="Dashboard" type="button"><Home size={15} /></button>
          <div>
            <h1 className="truncate text-sm font-semibold leading-4 text-[#c8b89a]">{project.name}</h1>
            <p className="mono text-[9px] uppercase tracking-[0.12em] text-[#7a6a4a]">EDITOR · {APP_VERSION_LABEL}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="md-button h-8 w-8" onClick={undoProject} disabled={historyRef.current.length === 0} title="Undo" type="button"><Undo2 size={14} /></button>
          <button className="md-button h-8 w-8" onClick={redoProject} disabled={redoRef.current.length === 0} title="Redo" type="button"><Redo2 size={14} /></button>
          <div className="mx-1 h-4 w-px bg-[#111009]" />
          <button className="md-button h-8 w-8" title="Zoom out" type="button"><ZoomOut size={14} /></button>
          <span className="mono flex h-8 min-w-12 items-center justify-center text-[10px] text-[#7a6a4a]">100%</span>
          <button className="md-button h-8 w-8" title="Zoom in" type="button"><ZoomIn size={14} /></button>
          <div className="mx-1 h-4 w-px bg-[#111009]" />
          <button className={`md-button h-8 w-8 ${showGrid ? 'border-[#e8a020] text-[#e8a020]' : 'border-[#e8a02055] text-[#e8a020]'}`} title="Toggle alignment grid" type="button" onClick={() => setShowGrid((value) => !value)}><Grid3x3 size={14} /></button>
          <button className="md-button h-8 w-8" title="Snap to grid" type="button" onClick={() => selectedSurfaceId && snapSurface(selectedSurfaceId)}><Magnet size={14} /></button>
          <div className="mx-1 h-4 w-px bg-[#111009]" />
          <div className="md-button h-8 gap-2 px-2" title={isDirty ? 'Unsaved changes' : 'Saved'}>
            <span className={`h-2 w-2 rounded-full ${isDirty ? 'md-save-pulse bg-[#e8a020]' : 'bg-[#2a2820]'}`} />
            <span className="mono text-[10px] uppercase tracking-[0.12em]">{isDirty ? 'Unsaved' : 'Saved'}</span>
          </div>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <ProjectorStatus status={syncStatus} projectorCount={projectorCount} />
          <button className="md-button h-8 gap-2 px-3 text-xs" onClick={copyProjectorLink} type="button">
            {copiedProjectorLink ? <Check size={14} /> : <Copy size={14} />} {copiedProjectorLink ? 'Copied' : 'Copy link'}
          </button>
          <a className="md-button md-button-amber h-8 gap-2 px-3 text-xs font-semibold" href={projectorUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Projector
          </a>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-9 shrink-0 flex-col items-center gap-1 border-r border-[#111009] bg-[#0a0908] py-2">
          <button className="md-rail-button md-rail-button-active" title="Select" type="button"><MousePointer2 size={15} /></button>
          <button className="md-rail-button" title="Pan" type="button"><Move size={15} /></button>
          <div className="my-1 h-px w-[18px] bg-[#161410]" />
          <button className={`md-rail-button ${leftPanelOpen ? 'md-rail-button-active' : ''}`} onClick={() => setLeftPanelOpen((open) => !open)} title="Media" type="button"><ImageIcon size={15} /></button>
          <button className={`md-rail-button ${rightPanelOpen ? 'md-rail-button-active' : ''}`} onClick={() => setRightPanelOpen((open) => !open)} title="Surfaces" type="button"><Layers size={15} /></button>
          <div className="my-1 h-px w-[18px] bg-[#161410]" />
          <button className="md-rail-button" title="Settings" type="button"><Settings size={15} /></button>
        </aside>
        {leftPanelOpen && (
          <aside className="w-[188px] shrink-0 overflow-y-auto border-r border-[#111009] bg-[#0a0908]">
            <MediaPanel media={project.media} notice={mediaNotice} onUpload={handleUpload} onAddSample={handleAddSample} />
            <FirstRunChecklist project={project} projectorCount={projectorCount} />
          </aside>
        )}
        <EditorCanvas project={project} selectedSurfaceId={selectedSurfaceId} onSelectSurface={setSelectedSurfaceId} onMoveCorner={moveCorner} onMoveSurface={moveSurface} showGrid={showGrid} />
        {rightPanelOpen && (
          <aside className="w-[188px] shrink-0 overflow-y-auto border-l border-[#111009] bg-[#0a0908]">
            <SurfaceControls
              surfaces={project.surfaces}
              media={project.media}
              selectedSurfaceId={selectedSurfaceId}
              onSelectSurface={setSelectedSurfaceId}
              onAddSurface={addSurface}
              onDeleteSurface={deleteSurface}
              onPatchSurface={patchSurface}
              onPatchMedia={patchMedia}
              onCenterSurface={centerSurface}
              onFitSurface={fitSurface}
              onResetSurface={resetSurface}
              onDuplicateSurface={duplicateSelectedSurface}
              onBringForward={bringSurfaceForward}
              onSendBackward={sendSurfaceBackward}
              onSnapToGrid={snapSurface}
              onOpenCalibration={setCalibratingSurfaceId}
              onAlignSeam={alignSeam}
            />
          </aside>
        )}
      </div>
      {calibratingSurface && (
        <CalibrationPanel
          surface={calibratingSurface}
          onChangeCalibration={(calibration) => setSurfaceCalibration(calibratingSurface.id, calibration)}
          onFlash={(starName) => flashReferenceStar(calibratingSurface.id, starName)}
          onClose={() => setCalibratingSurfaceId('')}
        />
      )}
    </main>
  );
}
