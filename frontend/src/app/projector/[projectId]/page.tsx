import { useEffect, useRef, useState } from 'react';
import { FullscreenButton } from '../../../components/projector/FullscreenButton';
import { ProjectorRenderer } from '../../../components/projector/ProjectorRenderer';
import { getProject } from '../../../lib/projects/projectRepository';
import type { ProjectState } from '../../../lib/projects/types';
import { ProjectRealtimeClient } from '../../../lib/realtime/realtimeClient';
import { sceneToProjectState } from '../../../lib/rendering/sceneAdapter';

function mergeResolvedMediaUrls(project: ProjectState, resolved: ProjectState) {
  const urlsById = new Map(resolved.media.map((item) => [item.id, item.url]));
  return {
    ...project,
    media: project.media.map((item) => {
      const resolvedUrl = urlsById.get(item.id);
      return resolvedUrl ? { ...item, url: resolvedUrl } : item;
    })
  };
}

export function ProjectorPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [status, setStatus] = useState('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const receivedRealtimeRef = useRef(false);

  useEffect(() => {
    let active = true;
    receivedRealtimeRef.current = false;
    getProject(projectId).then((loaded) => {
      if (!active) return;
      const loadedProject = sceneToProjectState(loaded);
      if (receivedRealtimeRef.current) {
        setProject((current) => current ? mergeResolvedMediaUrls(current, loadedProject) : loadedProject);
      } else {
        setProject(loadedProject);
      }
    });
    const client = new ProjectRealtimeClient(projectId, 'projector', {
      onStatus: setStatus,
      onProject: (next) => {
        receivedRealtimeRef.current = true;
        setProject(sceneToProjectState(next));
      },
      onError: () => setStatus('local')
    });
    client.connect();
    return () => {
      active = false;
      client.disconnect();
    };
  }, [projectId]);

  useEffect(() => {
    const onFullscreen = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'g' || event.key === 'G') setShowGrid((value) => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let timer = 0;
    const showCursor = () => {
      setCursorHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorHidden(true), 2500);
    };
    window.addEventListener('pointermove', showCursor);
    showCursor();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', showCursor);
    };
  }, []);

  if (!project) return <div className="flex min-h-screen items-center justify-center bg-black text-slate-200">Loading projector...</div>;

  return (
    <main ref={shellRef} className={`relative flex h-screen w-screen items-center justify-center overflow-hidden bg-black ${cursorHidden ? 'cursor-none' : ''}`}>
      <ProjectorRenderer project={project} showGrid={showGrid} />
      {!isFullscreen && (
        <div className="absolute left-4 top-4 flex items-center gap-3 rounded border border-white/10 bg-black/60 p-3 backdrop-blur">
          <FullscreenButton target={shellRef} isFullscreen={isFullscreen} onChange={() => setIsFullscreen(!!document.fullscreenElement)} />
          <button
            className={`mono rounded border px-2 py-1 text-xs uppercase tracking-wider ${showGrid ? 'border-[#e8a020] text-[#e8a020]' : 'border-white/10 text-slate-300'}`}
            onClick={() => setShowGrid((value) => !value)}
            type="button"
            title="Toggle alignment grid (G)"
          >
            Grid
          </button>
          <span className="mono text-xs uppercase tracking-wider text-slate-300">{status === 'synced' || status === 'connected' ? 'Synced' : 'Local'}</span>
        </div>
      )}
    </main>
  );
}
