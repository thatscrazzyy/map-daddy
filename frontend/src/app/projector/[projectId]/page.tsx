import { useEffect, useRef, useState } from 'react';
import { FullscreenButton } from '../../../components/projector/FullscreenButton';
import { ProjectorRenderer } from '../../../components/projector/ProjectorRenderer';
import { getProject } from '../../../lib/projects/projectRepository';
import type { ProjectState } from '../../../lib/projects/types';
import { ProjectRealtimeClient } from '../../../lib/realtime/realtimeClient';

export function ProjectorPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [status, setStatus] = useState('connecting');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorHidden, setCursorHidden] = useState(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    getProject(projectId).then((loaded) => {
      if (active) setProject(loaded);
    });
    const client = new ProjectRealtimeClient(projectId, 'projector', {
      onStatus: setStatus,
      onProject: (next) => setProject(next),
      onError: setStatus
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
      <ProjectorRenderer project={project} />
      {!isFullscreen && (
        <div className="absolute left-4 top-4 flex items-center gap-3 rounded border border-white/10 bg-black/60 p-3 backdrop-blur">
          <FullscreenButton target={shellRef} isFullscreen={isFullscreen} onChange={() => setIsFullscreen(!!document.fullscreenElement)} />
          <span className="mono text-xs uppercase tracking-wider text-slate-300">{status}</span>
        </div>
      )}
    </main>
  );
}
