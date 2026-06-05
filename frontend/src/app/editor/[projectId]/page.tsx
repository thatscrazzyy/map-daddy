import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Home, Save } from 'lucide-react';
import { EditorCanvas } from '../../../components/editor/EditorCanvas';
import { MediaPanel } from '../../../components/editor/MediaPanel';
import { ProjectorStatus } from '../../../components/editor/ProjectorStatus';
import { SurfaceControls } from '../../../components/editor/SurfaceControls';
import { createDefaultSurface } from '../../../lib/projects/defaultProject';
import { getProject, saveProject, uploadMedia } from '../../../lib/projects/projectRepository';
import {
  centerSurfaceOnCanvas,
  duplicateSurface,
  fitSurfaceToCanvas,
  moveSurfaceBackward,
  moveSurfaceForward,
  resetSurfaceRectangle,
  snapSurfaceToGrid
} from '../../../lib/projects/surfaceOperations';
import type { MappingSurface, ProjectMedia, ProjectState } from '../../../lib/projects/types';
import { ProjectRealtimeClient } from '../../../lib/realtime/realtimeClient';
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
  const [saveStatus, setSaveStatus] = useState('');
  const [copiedProjectorLink, setCopiedProjectorLink] = useState(false);
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
        onError: (message) => setSyncStatus(message)
      });
      realtimeRef.current = client;
      client.connect();
      client.sendProject(loaded, true);
    });
    return () => {
      active = false;
      window.clearTimeout(saveTimerRef.current);
      realtimeRef.current?.disconnect();
    };
  }, [projectId]);

  const projectorPath = useMemo(() => `/projector/${projectId}`, [projectId]);
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
    setSaveStatus('Saving...');
    saveTimerRef.current = window.setTimeout(() => {
      saveProject(state).then(() => {
        setSaveStatus('Saved');
        window.setTimeout(() => setSaveStatus(''), 1200);
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
      setSaveStatus('Saving...');
      saveTimerRef.current = window.setTimeout(() => {
        saveProject(next).then(() => {
          setSaveStatus('Saved');
          window.setTimeout(() => setSaveStatus(''), 1200);
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
    const dimensions = await mediaDimensions(file);
    const media = await uploadMedia(file);
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

  const go = (path: string) => {
    window.history.pushState({}, '', path);
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

  if (!project) return <div className="flex min-h-screen items-center justify-center bg-[#0b0d12] text-slate-100">Loading project...</div>;

  return (
    <main className="flex h-screen flex-col bg-[#0b0d12] text-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-[#121620] px-4">
        <div className="flex items-center gap-3">
          <button className="flex h-9 w-9 items-center justify-center rounded border border-white/10 bg-white/[0.04] hover:bg-white/[0.08]" onClick={() => go('/dashboard')} title="Dashboard"><Home size={17} /></button>
          <div>
            <h1 className="text-lg font-bold">{project.name}</h1>
            <p className="mono text-[10px] uppercase tracking-wider text-slate-500">Editor / {APP_VERSION_LABEL}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus && <span className="mono text-xs uppercase text-cyan-200"><Save size={13} className="mr-1 inline" />{saveStatus}</span>}
          <ProjectorStatus status={syncStatus} projectorCount={projectorCount} />
          <button className="inline-flex h-9 items-center gap-2 rounded border border-white/15 bg-white/[0.04] px-3 text-sm hover:border-cyan-300/50" onClick={copyProjectorLink}>
            {copiedProjectorLink ? <Check size={15} /> : <Copy size={15} />} {copiedProjectorLink ? 'Copied' : 'Copy Projector Link'}
          </button>
          <a className="inline-flex h-9 items-center gap-2 rounded border border-white/15 bg-white/[0.04] px-3 text-sm hover:border-cyan-300/50" href={projectorUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={15} /> Projector
          </a>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[300px,1fr,300px] gap-4 p-4 max-lg:grid-cols-1 max-lg:overflow-auto">
        <div className="space-y-4">
          <MediaPanel media={project.media} onUpload={handleUpload} />
        </div>
        <EditorCanvas project={project} selectedSurfaceId={selectedSurfaceId} onSelectSurface={setSelectedSurfaceId} onMoveCorner={moveCorner} onMoveSurface={moveSurface} />
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
        />
      </div>
    </main>
  );
}
