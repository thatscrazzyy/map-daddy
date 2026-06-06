import { useEffect, useMemo, useRef } from 'react';
import { normalizeVideoPlaybackSettings } from '../../lib/projects/defaultProject';
import type { ProjectMedia, ProjectState } from '../../lib/projects/types';
import { drawCalibrationGrid, renderProjectToCanvas } from '../../lib/rendering/canvasRenderer';
import { LiveSkyManager } from '../../layers/skyScene';

type Drawable = HTMLImageElement | HTMLVideoElement;
type AppliedVideoSettings = {
  signature: string;
  startTime: number;
};

const appliedVideoSettings = new WeakMap<HTMLVideoElement, AppliedVideoSettings>();

function seekVideo(video: HTMLVideoElement, startTime: number) {
  const seek = () => {
    const target = Number.isFinite(video.duration) && video.duration > 0
      ? Math.min(startTime, video.duration)
      : startTime;
    if (Math.abs(video.currentTime - target) > 0.05) {
      video.currentTime = target;
    }
  };

  if (video.readyState >= 1) {
    seek();
  } else {
    video.addEventListener('loadedmetadata', seek, { once: true });
  }
}

function applyVideoSettings(video: HTMLVideoElement, media: ProjectMedia) {
  const settings = normalizeVideoPlaybackSettings(media.videoSettings);
  const signature = `${settings.loop}:${settings.muted}:${settings.playbackRate}:${settings.startTime}`;
  const previous = appliedVideoSettings.get(video);

  video.loop = settings.loop;
  video.muted = settings.muted;
  video.defaultPlaybackRate = settings.playbackRate;
  video.playbackRate = settings.playbackRate;
  video.playsInline = true;

  if (!previous || previous.startTime !== settings.startTime) {
    seekVideo(video, settings.startTime);
  }

  if (!previous || previous.signature !== signature) {
    video.play().catch(() => undefined);
    appliedVideoSettings.set(video, {
      signature,
      startTime: settings.startTime
    });
  }
}

function loadDrawable(media: ProjectMedia): Drawable {
  if (media.type === 'video') {
    const video = document.createElement('video');
    video.src = media.url;
    video.crossOrigin = 'anonymous';
    applyVideoSettings(video, media);
    return video;
  }

  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = media.url;
  return image;
}

export function ProjectorRenderer({ project, className = '', showGrid = false }: { project: ProjectState; className?: string; showGrid?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaMapRef = useRef(new Map<string, Drawable>());
  const liveManagerRef = useRef<LiveSkyManager | null>(null);
  const projectRef = useRef(project);
  projectRef.current = project;
  const showGridRef = useRef(showGrid);
  showGridRef.current = showGrid;
  const mediaSignature = useMemo(() => project.media.map((item) => `${item.id}:${item.url}:${item.type}`).join('|'), [project.media]);
  const videoSettingsSignature = useMemo(() => project.media.map((item) => {
    if (item.type !== 'video') return `${item.id}:image`;
    const settings = normalizeVideoPlaybackSettings(item.videoSettings);
    return `${item.id}:${settings.loop}:${settings.muted}:${settings.playbackRate}:${settings.startTime}`;
  }).join('|'), [project.media]);

  useEffect(() => {
    const mediaMap = new Map<string, Drawable>();
    for (const media of project.media) {
      const existing = mediaMapRef.current.get(media.id);
      const reusable = existing
        && existing.getAttribute('src') === media.url
        && ((media.type === 'video' && existing instanceof HTMLVideoElement) || (media.type === 'image' && existing instanceof HTMLImageElement));
      if (reusable) {
        mediaMap.set(media.id, existing);
      } else if (media.url) {
        mediaMap.set(media.id, loadDrawable(media));
      }
    }

    for (const [mediaId, drawable] of mediaMapRef.current) {
      if (!mediaMap.has(mediaId) && drawable instanceof HTMLVideoElement) {
        drawable.pause();
        drawable.removeAttribute('src');
        drawable.load();
      }
    }

    mediaMapRef.current = mediaMap;
  }, [mediaSignature]);

  useEffect(() => {
    for (const media of project.media) {
      if (media.type !== 'video') continue;
      const drawable = mediaMapRef.current.get(media.id);
      if (drawable instanceof HTMLVideoElement) {
        applyVideoSettings(drawable, media);
      }
    }
  }, [videoSettingsSignature, project.media]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = project.canvas.width;
    canvas.height = project.canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    const render = () => {
      const current = projectRef.current;
      const hasLive = current.surfaces.some((surface) => surface.contentType === 'live');
      let liveCanvases: Map<string, HTMLCanvasElement> | undefined;
      if (hasLive) {
        if (!liveManagerRef.current) liveManagerRef.current = new LiveSkyManager();
        liveCanvases = liveManagerRef.current.update(current.surfaces, new Date());
      } else if (liveManagerRef.current) {
        liveManagerRef.current.dispose();
        liveManagerRef.current = null;
      }
      renderProjectToCanvas(ctx, current, mediaMapRef.current, liveCanvases);
      if (showGridRef.current) drawCalibrationGrid(ctx, current.canvas.width, current.canvas.height);
      frame = window.requestAnimationFrame(render);
    };
    render();
    return () => window.cancelAnimationFrame(frame);
  }, [project]);

  useEffect(() => () => {
    liveManagerRef.current?.dispose();
    liveManagerRef.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`block h-full w-full bg-black object-contain ${className}`}
      aria-label={`${project.name} projector output`}
    />
  );
}
