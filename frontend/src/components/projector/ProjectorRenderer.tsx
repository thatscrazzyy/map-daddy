import { useEffect, useMemo, useRef } from 'react';
import type { ProjectMedia, ProjectState } from '../../lib/projects/types';
import { renderProjectToCanvas } from '../../lib/rendering/canvasRenderer';

type Drawable = HTMLImageElement | HTMLVideoElement;

function loadDrawable(media: ProjectMedia): Drawable {
  if (media.type === 'video') {
    const video = document.createElement('video');
    video.src = media.url;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.play().catch(() => undefined);
    return video;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = media.url;
  return image;
}

export function ProjectorRenderer({ project, className = '' }: { project: ProjectState; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaMapRef = useRef(new Map<string, Drawable>());
  const mediaSignature = useMemo(() => project.media.map((item) => `${item.id}:${item.url}:${item.type}`).join('|'), [project.media]);

  useEffect(() => {
    const mediaMap = new Map<string, Drawable>();
    for (const media of project.media) {
      const existing = mediaMapRef.current.get(media.id);
      if (existing && existing.getAttribute('src') === media.url) {
        mediaMap.set(media.id, existing);
      } else if (media.url) {
        mediaMap.set(media.id, loadDrawable(media));
      }
    }
    mediaMapRef.current = mediaMap;
  }, [mediaSignature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const render = () => {
      renderProjectToCanvas(ctx, project, mediaMapRef.current);
      frame = window.requestAnimationFrame(render);
    };
    render();
    return () => window.cancelAnimationFrame(frame);
  }, [project]);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full bg-black object-contain ${className}`}
      aria-label={`${project.name} projector output`}
    />
  );
}
