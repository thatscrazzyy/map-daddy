import type {
  LiveLayerConfig,
  LiveLayerId,
  MappingSurface,
  ProjectState,
  SurfaceCalibration,
  SurfaceContentType,
  VideoPlaybackSettings
} from './types';
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

export const DEFAULT_LIVE_LAYER_ID: LiveLayerId = 'bedroom-sky';

export const DEFAULT_LIVE_CONFIG: LiveLayerConfig = {
  lat: 32.7,
  lon: -97.3,
  showStars: true,
  showISS: true,
  showFlights: true,
  showAurora: true,
  starSize: 1.4,
  opacity: 1
};

export const DEFAULT_CALIBRATION: SurfaceCalibration = {
  wallBearingDeg: 220,
  fovDeg: 80,
  rotationOffsetDeg: 0,
  elevationOffsetDeg: 0,
  pitchDeg: 0
};

export function normalizeLiveConfig(config: Partial<LiveLayerConfig> | null | undefined): LiveLayerConfig {
  return {
    lat: finiteNumber(config?.lat, DEFAULT_LIVE_CONFIG.lat),
    lon: finiteNumber(config?.lon, DEFAULT_LIVE_CONFIG.lon),
    showStars: config?.showStars !== false,
    showISS: config?.showISS !== false,
    showFlights: config?.showFlights !== false,
    showAurora: config?.showAurora !== false,
    starSize: Math.max(0.3, Math.min(4, finiteNumber(config?.starSize, DEFAULT_LIVE_CONFIG.starSize))),
    opacity: Math.max(0, Math.min(1, finiteNumber(config?.opacity, DEFAULT_LIVE_CONFIG.opacity)))
  };
}

export function normalizeCalibration(calibration: Partial<SurfaceCalibration> | null | undefined): SurfaceCalibration {
  return {
    wallBearingDeg: ((finiteNumber(calibration?.wallBearingDeg, DEFAULT_CALIBRATION.wallBearingDeg) % 360) + 360) % 360,
    fovDeg: Math.max(20, Math.min(160, finiteNumber(calibration?.fovDeg, DEFAULT_CALIBRATION.fovDeg))),
    rotationOffsetDeg: finiteNumber(calibration?.rotationOffsetDeg, 0),
    elevationOffsetDeg: finiteNumber(calibration?.elevationOffsetDeg, 0),
    pitchDeg: finiteNumber(calibration?.pitchDeg, 0)
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
    surfaces: (project?.surfaces || []).map((surface, index) => {
      const contentType: SurfaceContentType = surface.contentType === 'live' ? 'live' : 'image';
      const isLive = contentType === 'live';
      return {
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
          : createDefaultSurface(fallback).destinationQuad) as typeof surface.destinationQuad,
        edgeFeather: Math.max(0, Math.min(0.49, finiteNumber(surface.edgeFeather, 0))),
        contentType,
        ...(isLive
          ? {
              liveLayerId: surface.liveLayerId || DEFAULT_LIVE_LAYER_ID,
              liveConfig: normalizeLiveConfig(surface.liveConfig),
              calibration: normalizeCalibration(surface.calibration),
              ...(surface.flashTarget && surface.flashTarget.until > Date.now()
                ? { flashTarget: { name: String(surface.flashTarget.name), until: Number(surface.flashTarget.until) } }
                : {})
            }
          : {})
      };
    }) as ProjectState['surfaces'],
    updatedAt: project?.updatedAt || new Date().toISOString()
  };
}
