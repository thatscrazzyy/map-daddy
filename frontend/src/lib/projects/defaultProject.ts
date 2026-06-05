import type { MappingSurface, ProjectState, VideoPlaybackSettings } from './types';
import { normalizeSourceRect } from './sourceRect';

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const DEFAULT_VIDEO_PLAYBACK_SETTINGS: VideoPlaybackSettings = {
  loop: true,
  muted: true,
  playbackRate: 1,
  startTime: 0
};

function finiteNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeVideoPlaybackSettings(settings: Partial<VideoPlaybackSettings> | null | undefined): VideoPlaybackSettings {
  return {
    loop: settings?.loop !== false,
    muted: settings?.muted !== false,
    playbackRate: Math.max(0.25, Math.min(4, finiteNumber(settings?.playbackRate, DEFAULT_VIDEO_PLAYBACK_SETTINGS.playbackRate))),
    startTime: Math.max(0, finiteNumber(settings?.startTime, DEFAULT_VIDEO_PLAYBACK_SETTINGS.startTime))
  };
}

export function createDefaultSurface(project: ProjectState, mediaId = ''): MappingSurface {
  const { width, height } = project.canvas;
  return {
    id: uid('surface'),
    name: `Surface ${(project.surfaces?.length || 0) + 1}`,
    mediaId,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    sourceRect: { x: 0, y: 0, width, height },
    destinationQuad: [
      { x: Math.round(width * 0.25), y: Math.round(height * 0.25) },
      { x: Math.round(width * 0.75), y: Math.round(height * 0.25) },
      { x: Math.round(width * 0.75), y: Math.round(height * 0.75) },
      { x: Math.round(width * 0.25), y: Math.round(height * 0.75) }
    ]
  };
}

export function createDefaultProject(name = 'Untitled Project'): ProjectState {
  const id = uid('project');
  return {
    id,
    name,
    canvas: {
      width: 1920,
      height: 1080,
      backgroundColor: '#000000'
    },
    media: [],
    surfaces: [],
    updatedAt: new Date().toISOString()
  };
}

export function normalizeProject(project: Partial<ProjectState> | null | undefined): ProjectState {
  const fallback = createDefaultProject(project?.name || 'Untitled Project');
  const canvas = project?.canvas || fallback.canvas;
  return {
    id: project?.id || fallback.id,
    name: project?.name || fallback.name,
    canvas: {
      width: Number(canvas.width || 1920),
      height: Number(canvas.height || 1080),
      backgroundColor: canvas.backgroundColor || '#000000'
    },
    media: (project?.media || []).map((item, index) => {
      const type = item.type === 'video' ? 'video' : 'image';
      return {
        id: item.id || uid('media'),
        type,
        url: item.url || '',
        name: item.name || `Media ${index + 1}`,
        ...(type === 'video' ? { videoSettings: normalizeVideoPlaybackSettings(item.videoSettings) } : {})
      };
    }),
    surfaces: (project?.surfaces || []).map((surface, index) => ({
      id: surface.id || uid('surface'),
      name: surface.name || `Surface ${index + 1}`,
      mediaId: surface.mediaId || '',
      visible: surface.visible !== false,
      opacity: Number(surface.opacity ?? 1),
      blendMode: surface.blendMode || 'source-over',
      sourceRect: normalizeSourceRect({
        x: surface.sourceRect?.x ?? 0,
        y: surface.sourceRect?.y ?? 0,
        width: surface.sourceRect?.width ?? canvas.width ?? 1920,
        height: surface.sourceRect?.height ?? canvas.height ?? 1080
      }),
      destinationQuad: (surface.destinationQuad?.length === 4
        ? surface.destinationQuad
        : createDefaultSurface(fallback).destinationQuad) as typeof surface.destinationQuad
    })) as ProjectState['surfaces'],
    updatedAt: project?.updatedAt || new Date().toISOString()
  };
}
